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

### C. Upgrade oauth2-proxy

The current version is `v7.5.1`. Consider upgrading to the latest v7.7.x+:

```yaml
image: quay.io/oauth2-proxy/oauth2-proxy:v7.8.1
```

Several relevant bugs were fixed in later releases around cookie handling, CSRF validation, and redirect loop detection.

## Attempt Log

| #   | Change                                                               | Result                                                                                                  |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | Fixed `OAUTH2_PROXYSET_SET_*` typos, removed `SET_BASIC_AUTH`        | oauth2-proxy started cleanly; cyclical login still present                                              |
| 2   | `SameSite=lax` → `SameSite=none`                                     | 403 "Unable to find a valid CSRF token" — VPN/browser strips `SameSite=none` cookies. **Reverted.**     |
| 3   | Added `OAUTH2_PROXY_COOKIE_DOMAINS: ".fit.nasa.gov"`                 | 403 "upstream identity provider returned server_error" — CSRF cookie domain conflict. **Reverted.**     |
| 4   | `X-Auth-Request-Redirect` changed to `$scheme://$host$request_uri`   | Firefox: fixed 403. Chrome: still loops.                                                                |
| 5   | Added proxy headers to callback + all oauth2-proxy locations         | Firefox: works. Chrome: still loops.                                                                    |
| 6   | CSRF per-request + 30m expiry                                        | Deployed alongside #7 and #8. Firefox still works. Chrome still loops.                                  |
| 7   | Removed multi-part cookie splitting in nginx                         | Deployed. No change on its own.                                                                         |
| 8   | Enabled debug logging on oauth2-proxy (temporary)                    | **Revealed root cause**: oauth2-proxy rejects absolute redirect URL as "domain not in whitelist".       |
| 9   | Added `.fit.nasa.gov` to `OAUTH2_PROXY_WHITELIST_DOMAIN`             | Comma-separated env var not parsed correctly through docker-compose `.env` interpolation. **Reverted.** |
| 10  | Reverted `X-Auth-Request-Redirect` back to relative `$request_uri`   | No errors in oauth2-proxy logs, but Chrome still loops — callback never reached.                        |
| 11  | Removed `approval_prompt=force` (`OAUTH2_PROXY_APPROVAL_PROMPT: ""`) | Still loops in Chrome. IWA/Negotiate is the real issue, not force re-auth.                          |
| 12  | Added `wauth=urn:oasis:names:tc:SAML:1.0:am:X509-PKI` to login URL  | ADFS ignores `wauth` on OAuth2 endpoint (WS-Fed only). Still loops. **Reverted.**                   |
| 13  | Added `OAUTH2_PROXY_ACR_VALUES` for X.509 cert auth                  | Testing. OIDC-standard `acr_values` → ADFS maps to SAML `RequestedAuthnContext`.                    |

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
