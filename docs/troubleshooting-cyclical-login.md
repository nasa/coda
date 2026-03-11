# Troubleshooting: Cyclical LaunchPad Login Loop

## Problem

Some users experience an infinite redirect loop during LaunchPad (oauth2-proxy → ADFS) authentication. After entering credentials, the browser is repeatedly redirected back to the login prompt instead of reaching the app. The issue is intermittent and varies by:

- **VPN**: Occurs on certain VPN connections but not on native NASA-cert laptops
- **Browser**: Affects Chrome for some users, Edge or Firefox for others

## Authentication Flow

```
Browser → nginx (auth_request) → oauth2-proxy (/oauth2/auth)
  → 401 → redirect to /oauth2/sign_in
  → redirect to LaunchPad ADFS (authorize endpoint)
  → user authenticates
  → LaunchPad redirects to /api/v1/auth/nasalp/adfs/oidc/login
  → nginx proxies to oauth2-proxy /oauth2/callback
  → oauth2-proxy exchanges code for token, stores session in Redis
  → Set-Cookie: SESSION=...; sent back to browser
  → browser redirects to original URL with SESSION cookie
  → nginx auth_request succeeds → page loads
```

The loop occurs when something breaks between the callback (step 7) and the subsequent authenticated request (step 9), causing the SESSION cookie to either not be set, not be sent, or not be recognized.

### Root Cause (identified from Chrome network trace + Firefox comparison)

The callback to our server **never happens** for Chrome/Edge. The loop is entirely within LaunchPad's internal SAML/IWA/Kerberos flow. Firefox works because it **does not participate in IWA (Integrated Windows Authentication)**.

**Chrome/Edge on Windows** automatically respond to `WWW-Authenticate: Negotiate` challenges using Windows SSPI (Kerberos/NTLM). When LaunchPad's `/fed/iwa/` endpoint challenges them, Chrome tries Kerberos → fails (500 on VPN, port 88 blocked) → LaunchPad's broken fallback re-enters the IWA flow instead of completing the SAML assertion.

**Firefox** does NOT participate in IWA by default (requires explicit `network.negotiate-auth.trusted-uris` config). So when LaunchPad's IWA endpoint sends a Negotiate challenge, Firefox ignores it → LaunchPad immediately falls through to the smartcard-only path → completes cleanly → SAML assertion completes → ADFS issues code → callback reaches our server.

Chrome network trace showing the loop:

```
oauth2-proxy → ADFS authorize
  → LaunchPad SAML → IWA → kerblogin page
  → login.kerb → 500 (Kerberos fails on VPN - Chrome tried Negotiate/SSPI)
  → falls back to smartcard login page → user authenticates
  → login.sc → 302 (smartcard succeeds!)
  → iwa/?fedData=... → saml2sso → iwa/?type=social&type=social (duplicated!)
  → kerblogin page again (LOOPS BACK instead of completing to ADFS → callback)
  → login.kerb → 500 (Kerberos fails again - infinite loop)
```

Key evidence:

- `login.kerb` consistently returns **500** (Kerberos fails on VPN) — only in Chrome/Edge which attempt IWA
- After smartcard auth succeeds, LaunchPad redirects back into the SAML/IWA flow instead of completing
- The `type=social` parameter gets **duplicated** (`type=social&type=social`), showing redirect corruption in the IWA fallback
- The OIDC callback URL on our server is never reached in Chrome/Edge
- Firefox skips the entire IWA path → smartcard → completes → callback reaches our server → works
- Confirmed on iron dev server: same user, same VPN, same time — Firefox 200 OK, Chrome/Edge 302 loop

## Changes Applied

### 1. Fixed env var typos (committed)

```yaml
# BEFORE (silently ignored — "PROXYSET" is not a valid prefix)
OAUTH2_PROXYSET_SET_AUTHORIZATION_HEADER: true
OAUTH2_PROXYSET_SET_BASIC_AUTH: true

# AFTER
OAUTH2_PROXY_SET_AUTHORIZATION_HEADER: true
# OAUTH2_PROXY_SET_BASIC_AUTH removed — conflicts with SET_AUTHORIZATION_HEADER
# (both inject an Authorization header; oauth2-proxy v7.5.1 rejects duplicates)
```

### 2. ~~Changed `SameSite=lax` → `SameSite=none`~~ (REVERTED)

```yaml
OAUTH2_PROXY_COOKIE_SAMESITE: none
```

**REVERTED**: This caused 403 "Unable to find a valid CSRF token" errors. Some VPN proxies and older browser versions strip or reject `SameSite=none` cookies. The oauth2-proxy CSRF cookie (`_oauth2_proxy_csrf`) set before redirecting to LaunchPad was being dropped, so the callback validation failed. Reverted back to `SameSite=lax`.

### 3. ~~Added `OAUTH2_PROXY_COOKIE_DOMAINS`~~ (REVERTED)

```yaml
OAUTH2_PROXY_COOKIE_DOMAINS: ".fit.nasa.gov"
```

**REVERTED**: This caused a 403 "Login Failed: The upstream identity provider returned an error: server_error" on Firefox. Setting a broad cookie domain caused the OIDC CSRF cookie (used to validate the `state` parameter during the authorization code exchange) to be shared/conflicted across subdomains, corrupting the auth flow. LaunchPad ADFS then rejected the token exchange.

### 4. ~~Changed `X-Auth-Request-Redirect` to use full URL~~ (REVERTED)

```nginx
proxy_set_header X-Auth-Request-Redirect $scheme://$host$request_uri;
```

**REVERTED**: Absolute URLs trigger oauth2-proxy's redirect whitelist validation (`validator.go`), which requires the app's own domain to be in `OAUTH2_PROXY_WHITELIST_DOMAIN`. The comma-separated multi-domain syntax for this env var did not work reliably through docker-compose `.env` file interpolation. Reverted to the original `$request_uri` (relative path), which bypasses whitelist validation entirely. The forwarded proxy headers (change #5) handle the VPN-related concerns this was intended to address.

### 5. Added forwarded proxy headers to all oauth2-proxy locations (committed)

Added `X-Forwarded-Proto`, `X-Forwarded-Host`, and `X-Forwarded-For` to all three oauth2-proxy locations in `setup-auth.conf`: the callback (`/api/v1/auth/nasalp/adfs/oidc/login`), the main `/oauth2/` block, and `/oauth2/auth`.

Most critically, the **callback location** was missing **all** proxy headers — no `Host`, no `X-Real-IP`, no `X-Scheme`, nothing. When `OAUTH2_PROXY_REVERSE_PROXY: true` is set, oauth2-proxy uses these headers to construct redirect URLs and validate the CSRF state parameter. Without them, oauth2-proxy sees the internal Docker hostname and http scheme, which can cause the CSRF cookie domain/path to mismatch or redirect URLs to be wrong — both of which cause login loops.

### 6. CSRF per-request + extended expiry (committed)

```yaml
OAUTH2_PROXY_COOKIE_CSRF_PER_REQUEST: "true"
OAUTH2_PROXY_COOKIE_CSRF_EXPIRE: "30m"
```

**Why**: Chrome handles CSRF cookies more strictly during cross-site redirect chains. `CSRF_PER_REQUEST` generates a fresh CSRF token for each auth request (instead of reusing one that may have been set in a context Chrome no longer trusts), and the 30m expiry provides headroom for slow VPN round-trips.

### 7. Removed multi-part cookie splitting in nginx (committed)

Removed the `auth_cookie_name_upstream_1` / regex splitting logic from `route-require-auth.conf`. Since Redis session storage is used, the SESSION cookie only contains a small session ID — never the full JWT. The splitting logic was fragile: the regex extraction, the `if` blocks, and the duplicate `add_header Set-Cookie` could corrupt cookies when VPN proxies merge or strip duplicate `Set-Cookie` headers.

### 8. Enabled debug logging on oauth2-proxy (committed, temporary)

```yaml
command:
  - --http-address
  - 0.0.0.0:4180
  - --request-logging=true
  - --auth-logging=true
```

Reproduce the Chrome loop then run: `sudo docker compose logs oauth2-proxy --tail 200`

### 9. ~~Added app domain to `OAUTH2_PROXY_WHITELIST_DOMAIN`~~ (REVERTED)

No longer needed after reverting change #4 back to relative `$request_uri`. Relative redirect URLs are not validated against the whitelist.

### 11. ~~Removed `approval_prompt=force`~~ (did not fix)

```yaml
OAUTH2_PROXY_APPROVAL_PROMPT: ""
```

**Result**: Still loops in Chrome. The `approval_prompt` parameter was not the trigger — the loop is caused by Chrome's IWA/Negotiate behavior, not by ADFS being told to force re-auth. Keeping the empty value since `force` is unnecessary.

### 12. ~~Added `wauth` parameter to skip IWA/Kerberos~~ (did not fix)

Modified `OAUTH2_PROXY_LOGIN_URL` in `env.config.ts` to include a `wauth` hint:

```
https://authfs.launchpad-sbx.nasa.gov/adfs/oauth2/authorize/?wauth=urn:oasis:names:tc:SAML:1.0:am:X509-PKI
```

**Result**: ADFS ignored the `wauth` parameter on its OAuth2 endpoint — `wauth` is a WS-Federation parameter, not OIDC/OAuth2. The authorize flow still went through IWA → Kerberos → 500 → loop. **Reverted** (removed from login URL).

### 13. Added `acr_values` for X.509 cert authentication (testing)

```yaml
OAUTH2_PROXY_ACR_VALUES: "urn:oasis:names:tc:SAML:2.0:ac:classes:X509"
```

**Why**: `acr_values` is the OIDC-standard way to request a specific authentication method. ADFS maps this to `RequestedAuthnContext` in the SAML request it sends to the federated IdP (LaunchPad). Unlike `wauth` (WS-Fed only), `acr_values` is designed for OAuth2/OIDC endpoints and should propagate through the ADFS → SAML federation chain. If LaunchPad's SAML IdP respects `RequestedAuthnContext`, it should skip the IWA/Kerberos path and go directly to X.509 certificate (smartcard) authentication.

## LaunchPad IWA Bug Theory

The evidence strongly suggests this is a **bug in LaunchPad's IWA (Integrated Windows Authentication) fallback handler**, not something we can fix from the CODA side. Here is the detailed theory:

### The Bug

When LaunchPad's `/fed/iwa/` endpoint initiates Kerberos authentication and the browser's Kerberos attempt fails (HTTP 500 from `login.kerb`), the fallback mechanism is supposed to route the user to smartcard authentication and then **complete the SAML assertion** back to ADFS. Instead, after the user successfully authenticates via smartcard (`login.sc` → 302), LaunchPad's redirect chain **re-enters the IWA flow** rather than completing the SAML response.

### Why It's Browser-Specific

| Browser       | IWA/Negotiate Behavior                                                                             | Result                                      |
| ------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Chrome / Edge | Automatically respond to `WWW-Authenticate: Negotiate` via Windows SSPI                            | Triggers IWA path → Kerberos 500 → bug loop |
| Firefox       | Does NOT respond to Negotiate by default (requires explicit `network.negotiate-auth.trusted-uris`) | Skips IWA entirely → smartcard-only → works |

Chrome and Edge on Windows use the OS-level SSPI to handle `WWW-Authenticate: Negotiate` challenges transparently. When LaunchPad's `/fed/iwa/` endpoint issues this challenge, Chrome sends a Kerberos token. On VPN, the Kerberos KDC (port 88) is unreachable, so `login.kerb` returns 500. LaunchPad's fallback handler then corrupts the redirect chain.

Firefox ignores the Negotiate challenge entirely (it doesn't have `*.launchpad*.nasa.gov` in its `network.negotiate-auth.trusted-uris`), so LaunchPad never enters the IWA code path. It goes straight to the smartcard-only authentication flow, which works correctly.

### Why It's VPN-Specific

On the NASA network (or a VPN that allows Kerberos traffic), the Kerberos authentication at `login.kerb` **succeeds**. The IWA flow completes, the SAML assertion is returned to ADFS, ADFS issues an authorization code, the callback reaches our server, and everything works.

On VPNs that **block port 88** (Kerberos KDC), `login.kerb` fails with 500. This triggers the broken fallback path in LaunchPad's IWA handler.

### Evidence from Chrome Network Trace

```
1. oauth2-proxy → ADFS /oauth2/authorize (with our client_id, scopes, etc.)
2. ADFS → LaunchPad /affwebservices/public/saml2sso (SAML AuthnRequest)
3. LaunchPad → /fed/iwa/ (IWA endpoint — Chrome responds to Negotiate)
4. → /kerblogin (Kerberos login page renders)
5. → login.kerb → 500 ❌ (Kerberos fails — port 88 blocked on VPN)
6. → /login (falls back to smartcard page — user enters PIN)
7. → login.sc → 302 ✅ (smartcard auth succeeds!)
8. → /fed/iwa/?fedData=... → 302
9. → /affwebservices/public/saml2sso?type=social → 302
10. → /fed/iwa/?type=social&type=social → 302  ⚠️ (type=social DUPLICATED)
11. → /kerblogin → 200 (LOOPS BACK to Kerberos page!)
12. → login.kerb → 500 ❌ (fails again — infinite loop)
```

**Step 10 is the smoking gun**: the `type=social` parameter gets duplicated (`type=social&type=social`), indicating redirect URL corruption in LaunchPad's IWA fallback handler. After successful smartcard auth (step 7), instead of constructing the SAML Response back to ADFS, LaunchPad re-enters the IWA redirect chain with corrupted parameters.

### What We Tried to Fix It

We attempted to tell ADFS to skip the IWA path entirely:

- **`wauth=urn:oasis:names:tc:SAML:1.0:am:X509-PKI`** on the authorize URL — ADFS ignored it because `wauth` is a WS-Federation parameter, not OAuth2/OIDC
- **`acr_values=urn:oasis:names:tc:SAML:2.0:ac:classes:X509`** via `OAUTH2_PROXY_ACR_VALUES` — the OIDC-standard way to request a specific auth method, which ADFS should map to `RequestedAuthnContext` in the SAML request. ADFS did not propagate this to LaunchPad's IdP.
- **Upgraded oauth2-proxy to v7.8.1** — same behavior; confirms the loop is entirely within LaunchPad before the callback ever reaches our server.

Neither parameter can prevent Chrome from responding to the Negotiate challenge at LaunchPad's IWA endpoint — the IWA negotiation happens at the HTTP protocol level between the browser and LaunchPad's web server, before any SAML/OIDC parameters are evaluated.

### Possible Mitigations

Since we cannot fix LaunchPad's server-side IWA handling, the options are:

1. **Chrome enterprise policy `AuthServerAllowlist`**: Restrict which domains Chrome will send Negotiate/Kerberos credentials to. If `*.launchpad*.nasa.gov` is NOT in the allowlist, Chrome will behave like Firefox — skip IWA, go straight to smartcard. However, this requires client-side config (GPO or Chrome policy).

2. **User-level Chrome flag**: Users can navigate to `chrome://settings/content/federatedIdentityApi` or set `--auth-server-whitelist` to exclude LaunchPad domains. Not scalable.

3. **Report to LaunchPad team**: The IWA fallback handler has a bug where `type=social` gets duplicated in the redirect URL after a failed Kerberos + successful smartcard auth. The SAML assertion should complete back to ADFS after smartcard auth rather than re-entering the IWA flow. This is the proper fix.

4. **Detect the loop client-side**: In our frontend, detect repeated redirects to the sign-in page and show a message suggesting Firefox or explaining the workaround.

5. **Remove IWA from the ADFS relying party trust**: If the LaunchPad ADFS configuration for our client can be changed to disable IWA and only allow certificate-based auth, this would prevent the issue. Requires coordination with the LaunchPad admin team.

## Comparison: wiki.jsc.nasa.gov (works in Chrome on same VPN)

wiki.jsc.nasa.gov authenticates with LaunchPad successfully in Chrome over the same VPN where CODA loops. Analyzing its network trace reveals the **fundamental architectural difference** that explains everything.

### wiki.jsc.nasa.gov Chrome Network Trace (works)

```
1. wiki.jsc.nasa.gov → 302
2. auth.launchpad.nasa.gov/affwebservices/public/saml2sso?SAMLRequest=...&RelayState=https://wiki.jsc.nasa.gov/ → 302
3. /fed/iwa/?SAMLRequest=... → 302
4. /kerblogin → 302 (immediate redirect — NO Kerberos page rendered!)
5. /login → 200 (smartcard page — user enters PIN)
6. login.sc → 302 (smartcard succeeds!)
7. /fed/iwa/?fedData=... → 302
8. /affwebservices/public/saml2sso?SAMLRequest=... → 200 (SAML Response auto-submit form)
9. /simplesaml/module.php/saml/sp/saml2-acs.php/default-sp → 303
10. wiki.jsc.nasa.gov → 200 ✅ (page loads!)
```

### CODA Chrome Network Trace (loops)

```
1. coda-local.fit.nasa.gov → 302
2. oauth2-proxy → authfs.launchpad-sbx.nasa.gov/adfs/oauth2/authorize/ → 302
3. ADFS → LaunchPad /affwebservices/public/saml2sso (second SAML hop) → 302
4. /fed/iwa/ → 302
5. /kerblogin → 200 (renders Kerberos page with JS)
6. login.kerb → 500 ❌ (Kerberos fails on VPN)
7. /login → 200 (smartcard page — user enters PIN)
8. login.sc → 302 (smartcard succeeds!)
9. /fed/iwa/?fedData=... → 302
10. /saml2sso?type=social → 302
11. /fed/iwa/?type=social&type=social → 302 ⚠️ (type=social DUPLICATED!)
12. /kerblogin → 200 (LOOPS BACK — infinite loop)
```

### Critical Differences

| Aspect                    | wiki.jsc.nasa.gov (works)                  | CODA (loops)                                               |
| ------------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| **Auth architecture**     | Direct SAML SP → LaunchPad IdP             | oauth2-proxy → ADFS → LaunchPad (double federation)        |
| **LaunchPad server**      | `auth.launchpad.nasa.gov`                  | `authfs.launchpad-sbx.nasa.gov` ("**fs**" = **ADFS**)      |
| **Protocol to LaunchPad** | Direct SAML `SAMLRequest`                  | ADFS creates secondary SAML federation (via `type=social`) |
| **`kerblogin` behavior**  | 302 (immediate redirect, no Kerberos page) | 200 (renders page, JS calls `login.kerb` → 500)            |
| **After smartcard auth**  | `saml2sso` → 200 (SAML Response completes) | `saml2sso?type=social` → 302 → loops back into IWA         |
| **`type=social` param**   | Never appears                              | Appears and gets duplicated (ADFS social IdP federation)   |
| **Callback target**       | Wiki's SimpleSAML ACS endpoint (direct)    | ADFS (which must then issue OAuth2 code back to us)        |

### Why wiki Works and CODA Doesn't

The wiki is a **SAML Service Provider (SP)** that talks **directly** to LaunchPad's native SAML Identity Provider at `auth.launchpad.nasa.gov`. The SAML `AuthnRequest` goes straight from the wiki to LaunchPad, and after authentication, the SAML `Response` goes straight back to the wiki's Assertion Consumer Service (ACS) endpoint. There is no intermediary.

CODA uses **ADFS as an OAuth2/OIDC → SAML bridge**. The flow is:

1. oauth2-proxy sends an OAuth2 authorize request to ADFS (`authfs.launchpad-sbx.nasa.gov`)
2. ADFS creates a **second** SAML `AuthnRequest` to LaunchPad's IdP as a federated "social" identity provider
3. This federation adds the `type=social` parameter to the SAML flow
4. After authentication, LaunchPad must send the SAML Response back to ADFS (not directly to us)
5. ADFS then exchanges it for an OAuth2 authorization code and redirects to our callback

The `type=social` federation path in LaunchPad's IWA handler has the redirect corruption bug (step 11 above). The direct SAML path that wiki uses does NOT have this bug.

Additionally, `kerblogin` behaves differently: in the wiki flow it returns 302 immediately (suggesting the direct SAML path handles Kerberos failure more gracefully), while in CODA's ADFS-federated flow it returns 200 and tries Kerberos via XHR.

## Recommended Path Forward: Direct SAML Integration

The root cause is the **ADFS intermediary** creating a double-federation SAML flow with LaunchPad. The fix is to **eliminate ADFS and talk directly to LaunchPad via SAML**, like wiki.jsc.nasa.gov does.

### Option 1: Replace oauth2-proxy with a SAML-aware auth proxy

Replace oauth2-proxy entirely with a reverse-proxy that supports SAML SP natively:

- **[Vouch Proxy](https://github.com/vouch/vouch-proxy)** — Go-based, supports SAML and works with nginx `auth_request`, similar architecture to our current setup
- **Apache `mod_auth_mellon`** — mature SAML SP module, but requires switching from nginx to Apache (or running Apache as a sidecar)
- **[saml-proxy](https://github.com/bitly/saml-proxy)** — Bitly's SAML-aware reverse proxy (unmaintained but could serve as reference)

This approach would:

- Send SAML `AuthnRequest` directly to `auth.launchpad.nasa.gov` (not `authfs`)
- Receive SAML Response directly back (no ADFS federation)
- Bypass the `type=social` IWA bug entirely
- Require registering our app as a SAML SP with LaunchPad (instead of as an ADFS/OIDC client)

### Option 2: Use a local SAML → OIDC bridge (Keycloak, Dex, Satosa)

Keep oauth2-proxy but replace ADFS with a self-hosted identity broker:

- **[Keycloak](https://www.keycloak.org/)** — full-featured IdP that can act as a SAML SP to LaunchPad and expose OIDC to oauth2-proxy
- **[Dex](https://dexidp.io/)** — lightweight OIDC provider with SAML connector
- **[Satosa](https://github.com/IdentityPython/SATOSA)** — proxy that translates between SAML and OIDC

This approach would:

- Keep our nginx + oauth2-proxy architecture intact
- Replace the NASA-managed ADFS with our own SAML → OIDC bridge
- Talk directly to LaunchPad via SAML (bypassing the `type=social` bug)
- Add operational complexity (another service to maintain)

### Option 3: Check if LaunchPad supports direct OIDC

Some newer NASA ICAM deployments support OIDC natively. If `auth.launchpad.nasa.gov` (not `authfs`) exposes OIDC endpoints, we could point oauth2-proxy directly at it:

```yaml
# Hypothetical — needs verification with LaunchPad team
OAUTH2_PROXY_PROVIDER: oidc
OAUTH2_PROXY_OIDC_ISSUER_URL: https://auth.launchpad.nasa.gov
```

This would be the simplest change but depends on LaunchPad's OIDC support.

### Option 4: Report IWA bug + use Chrome policy as workaround

If changing the auth architecture is not feasible short-term:

1. **Report the bug** to the LaunchPad/ICAM team with the network traces showing the `type=social` duplication
2. **Deploy a Chrome enterprise policy** via GPO to remove `*.launchpad*.nasa.gov` from `AuthServerAllowlist`, making Chrome behave like Firefox (skip IWA)
3. **Add a client-side detection** in the frontend to detect the loop and suggest Firefox

## Additional Things to Try

### B. Add cookie refresh

Add to `docker-compose.yml` oauth2-proxy environment:

```yaml
OAUTH2_PROXY_COOKIE_REFRESH: "1m"
```

And ensure this line stays in `route-require-auth.conf`:

```nginx
auth_request_set $auth_cookie $upstream_http_set_cookie;
add_header Set-Cookie $auth_cookie;
```

**Why**: Cookie refresh causes oauth2-proxy to re-issue the SESSION cookie on every request made more than 1 minute after the last refresh. This mitigates stale/corrupted cookies from VPN interference.

### ~~C. Upgrade oauth2-proxy~~ (tried, did not fix)

Upgraded from `v7.5.1` to `v7.8.1`:

```yaml
image: quay.io/oauth2-proxy/oauth2-proxy:v7.8.1
```

**Result**: Same behavior — 401 → sign_in → 302 to LaunchPad → no callback. Confirms the issue is entirely within LaunchPad's IWA handler, not in oauth2-proxy.

## Attempt Log

| #   | Change                                                               | Result                                                                                                                                                                                    |
| --- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fixed `OAUTH2_PROXYSET_SET_*` typos, removed `SET_BASIC_AUTH`        | oauth2-proxy started cleanly; cyclical login still present                                                                                                                                |
| 2   | `SameSite=lax` → `SameSite=none`                                     | 403 "Unable to find a valid CSRF token" — VPN/browser strips `SameSite=none` cookies. **Reverted.**                                                                                       |
| 3   | Added `OAUTH2_PROXY_COOKIE_DOMAINS: ".fit.nasa.gov"`                 | 403 "upstream identity provider returned server_error" — CSRF cookie domain conflict. **Reverted.**                                                                                       |
| 4   | `X-Auth-Request-Redirect` changed to `$scheme://$host$request_uri`   | Firefox: fixed 403. Chrome: still loops.                                                                                                                                                  |
| 5   | Added proxy headers to callback + all oauth2-proxy locations         | Firefox: works. Chrome: still loops.                                                                                                                                                      |
| 6   | CSRF per-request + 30m expiry                                        | Deployed alongside #7 and #8. Firefox still works. Chrome still loops.                                                                                                                    |
| 7   | Removed multi-part cookie splitting in nginx                         | Deployed. No change on its own.                                                                                                                                                           |
| 8   | Enabled debug logging on oauth2-proxy (temporary)                    | **Revealed root cause**: oauth2-proxy rejects absolute redirect URL as "domain not in whitelist".                                                                                         |
| 9   | Added `.fit.nasa.gov` to `OAUTH2_PROXY_WHITELIST_DOMAIN`             | Comma-separated env var not parsed correctly through docker-compose `.env` interpolation. **Reverted.**                                                                                   |
| 10  | Reverted `X-Auth-Request-Redirect` back to relative `$request_uri`   | No errors in oauth2-proxy logs, but Chrome still loops — callback never reached.                                                                                                          |
| 11  | Removed `approval_prompt=force` (`OAUTH2_PROXY_APPROVAL_PROMPT: ""`) | Still loops in Chrome. IWA/Negotiate is the real issue, not force re-auth.                                                                                                                |
| 12  | Added `wauth=urn:oasis:names:tc:SAML:1.0:am:X509-PKI` to login URL   | ADFS ignores `wauth` on OAuth2 endpoint (WS-Fed only). Still loops. **Reverted.**                                                                                                         |
| 13  | Added `OAUTH2_PROXY_ACR_VALUES` for X.509 cert auth                  | ADFS did not propagate `acr_values` to LaunchPad's IdP. Still loops.                                                                                                                      |
| 14  | Upgraded oauth2-proxy from v7.5.1 to v7.8.1                          | Same behavior. Confirms loop is within LaunchPad, not oauth2-proxy.                                                                                                                       |
| 15  | Compared with wiki.jsc.nasa.gov (works in Chrome on same VPN)        | Wiki uses direct SAML to `auth.launchpad.nasa.gov`. CODA uses ADFS double-federation via `authfs`. The `type=social` ADFS federation path has the IWA redirect bug. Direct SAML does not. |

## Debugging Checklist

When reproducing the issue, check these in browser dev tools (Network tab):

1. **Does the `/oauth2/callback` response include a `Set-Cookie: SESSION=...` header?**
   - If no: oauth2-proxy isn't setting the cookie (check oauth2-proxy logs)
   - If yes: the cookie is being set but not sent back on the next request

2. **Is the SESSION cookie present in subsequent requests to `/oauth2/auth`?**
   - Open the Network tab, find the request to `/oauth2/auth`, check Request Headers for `Cookie: SESSION=...`
   - If missing: the browser is withholding the cookie (SameSite, Domain mismatch, or Secure flag issue)

3. **Does `/oauth2/auth` return 401 or 202?**
   - 401 = not authenticated (cookie missing, expired, or session not in Redis)
   - 202 = authenticated (auth is working, problem is elsewhere)

4. **Check the redirect chain**: In the Network tab, look at the full sequence of 302s. If you see the same URL appearing more than twice, that's the loop entry point.

5. **Compare request headers between working (Firefox) and non-working (Chrome) browsers** — look for differences in Cookie, Origin, Referer, and X-Forwarded-\* headers.
