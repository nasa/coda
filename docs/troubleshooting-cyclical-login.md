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

### 2. Changed `SameSite=lax` → `SameSite=none` (committed)

```yaml
# BEFORE
OAUTH2_PROXY_COOKIE_SAMESITE: lax

# AFTER
OAUTH2_PROXY_COOKIE_SAMESITE: none
```

**Why**: `SameSite=lax` cookies are only sent on top-level same-site navigations. VPN proxies that perform TLS inspection can rewrite the response in ways that make the browser treat the LaunchPad callback redirect as cross-origin, causing it to withhold the SESSION cookie. `SameSite=none` (with `Secure=true`, which is already set) removes this restriction. Different browsers enforce SameSite differently, which explains why the issue varies between Chrome/Edge/Firefox.

### 3. Added `OAUTH2_PROXY_COOKIE_DOMAINS` (committed)

```yaml
OAUTH2_PROXY_COOKIE_DOMAINS: ".fit.nasa.gov"
```

**Why**: Without this, the cookie domain defaults to the exact hostname of the request. If a VPN or proxy causes requests to arrive with a different hostname (e.g., IP address vs FQDN), the cookie domain won't match subsequent requests. Setting it to `.fit.nasa.gov` ensures the cookie works across all `*.fit.nasa.gov` subdomains.

### 4. Changed `X-Auth-Request-Redirect` to use full URL (committed)

```nginx
# BEFORE (in setup-auth.conf)
proxy_set_header X-Auth-Request-Redirect $request_uri;

# AFTER
proxy_set_header X-Auth-Request-Redirect $scheme://$host$request_uri;
```

**Why**: `$request_uri` is a relative path. When VPN proxies rewrite the Host header or strip/modify relative redirects, oauth2-proxy can't construct the correct post-login redirect URL. Using the full `$scheme://$host$request_uri` is more resilient. The codebase already noted this causes infinite redirects for the `/logout` location and removed it there — the same issue can affect login.

## Additional Things to Try

If the above changes don't resolve the issue, try these in order. Each can be tested independently on a dev server or via `npm run docker:preview`.

### 5. Increase CSRF cookie expiration

Add to `docker-compose.yml` oauth2-proxy environment:

```yaml
OAUTH2_PROXY_COOKIE_CSRF_PER_REQUEST: "true"
OAUTH2_PROXY_COOKIE_CSRF_EXPIRE: "30m"
```

**Why**: oauth2-proxy creates a CSRF cookie during the auth flow with a default 15-minute expiry. If the VPN adds latency to the LaunchPad round-trip, or the user is slow to enter credentials, the CSRF cookie can expire before the callback completes, causing a silent auth failure and restart.

### 6. Try `SameSite=strict` instead of `none`

If `SameSite=none` causes other issues (e.g., CSRF concerns), try:

```yaml
OAUTH2_PROXY_COOKIE_SAMESITE: strict
```

This is the most restrictive setting. The tradeoff is that the SESSION cookie won't be sent on any cross-site navigation (e.g., clicking a link to CODA from another site will require re-auth).

### 7. Revert to `SameSite=lax` but add cookie refresh

```yaml
OAUTH2_PROXY_COOKIE_SAMESITE: lax
OAUTH2_PROXY_COOKIE_REFRESH: "1m"
```

And ensure this line stays in `route-require-auth.conf`:

```nginx
auth_request_set $auth_cookie $upstream_http_set_cookie;
add_header Set-Cookie $auth_cookie;
```

**Why**: Cookie refresh causes oauth2-proxy to re-issue the SESSION cookie on every request made more than 1 minute after the last refresh. This mitigates stale/corrupted cookies from VPN interference.

### 8. Remove the multi-part cookie splitting in nginx

Since the app uses Redis for session storage (`OAUTH2_PROXY_SESSION_STORE_TYPE: redis`), the SESSION cookie should only contain a small session ID, not the full JWT. The cookie splitting logic in `route-require-auth.conf` (lines 27-39) may actually be causing problems by reconstructing cookies incorrectly. Try removing it:

```nginx
# REMOVE or comment out everything below line 22 in route-require-auth.conf:
# auth_request_set $auth_cookie_name_upstream_1 ...
# if ($auth_cookie ~* ...) { ... }
# if ($auth_cookie_name_upstream_1) { ... }
```

If the cookie truly exceeds 4KB even with Redis sessions, something else is wrong.

### 9. Add `proxy_set_header X-Forwarded-Proto` and `X-Forwarded-Host`

In `setup-auth.conf`, add to both `/oauth2/` and `/oauth2/auth` blocks:

```nginx
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host  $host;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
```

**Why**: VPN proxies may strip these standard headers. oauth2-proxy uses them to construct redirect URLs when `OAUTH2_PROXY_REVERSE_PROXY: true` is set. Missing headers can cause oauth2-proxy to generate redirect URLs with the wrong scheme (http vs https) or wrong hostname.

### 10. Upgrade oauth2-proxy

The current version is `v7.5.1`. Consider upgrading to the latest v7.7.x+:

```yaml
image: quay.io/oauth2-proxy/oauth2-proxy:v7.8.1
```

Several relevant bugs were fixed in later releases around cookie handling, CSRF validation, and redirect loop detection.

### 11. Add debug logging to oauth2-proxy

For diagnosis, temporarily enable verbose logging:

```yaml
command:
  - --http-address
  - 0.0.0.0:4180
  - --request-logging=true
  - --auth-logging=true
```

Then reproduce the loop and check `sudo docker compose logs oauth2-proxy --tail 200` for specific error messages during the redirect cycle.

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
