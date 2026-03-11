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

### 4. Changed `X-Auth-Request-Redirect` to use full URL (committed)

```nginx
# BEFORE (in setup-auth.conf)
proxy_set_header X-Auth-Request-Redirect $request_uri;

# AFTER
proxy_set_header X-Auth-Request-Redirect $scheme://$host$request_uri;
```

**Why**: `$request_uri` is a relative path. When VPN proxies rewrite the Host header or strip/modify relative redirects, oauth2-proxy can't construct the correct post-login redirect URL. Using the full `$scheme://$host$request_uri` is more resilient. The codebase already noted this causes infinite redirects for the `/logout` location and removed it there — the same issue can affect login.

### 5. Added forwarded proxy headers to all oauth2-proxy locations (committed)

Added `X-Forwarded-Proto`, `X-Forwarded-Host`, and `X-Forwarded-For` to all three oauth2-proxy locations in `setup-auth.conf`: the callback (`/api/v1/auth/nasalp/adfs/oidc/login`), the main `/oauth2/` block, and `/oauth2/auth`.

Most critically, the **callback location** was missing **all** proxy headers — no `Host`, no `X-Real-IP`, no `X-Scheme`, nothing. When `OAUTH2_PROXY_REVERSE_PROXY: true` is set, oauth2-proxy uses these headers to construct redirect URLs and validate the CSRF state parameter. Without them, oauth2-proxy sees the internal Docker hostname and http scheme, which can cause the CSRF cookie domain/path to mismatch or redirect URLs to be wrong — both of which cause login loops.

## Additional Things to Try

If the above changes don't resolve the issue, try these in order. Each can be tested independently on a dev server or via `npm run docker:preview`.

### A. Increase CSRF cookie expiration

Add to `docker-compose.yml` oauth2-proxy environment:

```yaml
OAUTH2_PROXY_COOKIE_CSRF_PER_REQUEST: "true"
OAUTH2_PROXY_COOKIE_CSRF_EXPIRE: "30m"
```

**Why**: oauth2-proxy creates a CSRF cookie during the auth flow with a default 15-minute expiry. If the VPN adds latency to the LaunchPad round-trip, or the user is slow to enter credentials, the CSRF cookie can expire before the callback completes, causing a silent auth failure and restart.

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

### C. Remove the multi-part cookie splitting in nginx

Since the app uses Redis for session storage (`OAUTH2_PROXY_SESSION_STORE_TYPE: redis`), the SESSION cookie should only contain a small session ID, not the full JWT. The cookie splitting logic in `route-require-auth.conf` (lines 27-39) may actually be causing problems by reconstructing cookies incorrectly. Try removing it:

```nginx
# REMOVE or comment out everything below line 22 in route-require-auth.conf:
# auth_request_set $auth_cookie_name_upstream_1 ...
# if ($auth_cookie ~* ...) { ... }
# if ($auth_cookie_name_upstream_1) { ... }
```

If the cookie truly exceeds 4KB even with Redis sessions, something else is wrong.

### D. Upgrade oauth2-proxy

The current version is `v7.5.1`. Consider upgrading to the latest v7.7.x+:

```yaml
image: quay.io/oauth2-proxy/oauth2-proxy:v7.8.1
```

Several relevant bugs were fixed in later releases around cookie handling, CSRF validation, and redirect loop detection.

### E. Add debug logging to oauth2-proxy

For diagnosis, temporarily enable verbose logging:

```yaml
command:
  - --http-address
  - 0.0.0.0:4180
  - --request-logging=true
  - --auth-logging=true
```

Then reproduce the loop and check `sudo docker compose logs oauth2-proxy --tail 200` for specific error messages during the redirect cycle.

## Attempt Log

| # | Change | Result |
|---|--------|--------|
| 1 | Fixed `OAUTH2_PROXYSET_SET_*` typos, removed `SET_BASIC_AUTH` | oauth2-proxy started cleanly; cyclical login still present |
| 2 | `SameSite=lax` → `SameSite=none` | 403 "Unable to find a valid CSRF token" — VPN/browser strips `SameSite=none` cookies. **Reverted.** |
| 3 | Added `OAUTH2_PROXY_COOKIE_DOMAINS: ".fit.nasa.gov"` | 403 "upstream identity provider returned server_error" — CSRF cookie domain conflict. **Reverted.** |
| 4 | `X-Auth-Request-Redirect` changed to `$scheme://$host$request_uri` | Deployed alongside #5. Testing. |
| 5 | Added proxy headers to callback + all oauth2-proxy locations | Deployed. Testing. |

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
