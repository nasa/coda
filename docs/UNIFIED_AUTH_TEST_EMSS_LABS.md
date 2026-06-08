# Unified Auth Test: `emss-labs.fit.nasa.gov/unified-auth`

> **Status:** Implementation guide — concrete steps to run a CODA test
> instance that delegates authentication to a shared oauth2-proxy running at
> `https://emss-labs.fit.nasa.gov/unified-auth`.  
> This is the "Option 2" pattern from [`UNIFIED_AUTH_TALKYBOT.md`](./UNIFIED_AUTH_TALKYBOT.md):
> each app's nginx keeps its own front door but forwards `auth_request`
> to the shared proxy instead of a sidecar oauth2-proxy.

---

## What we're building

```
Browser
  |
  | HTTPS to coda-labs-test.fit.nasa.gov (or whatever test hostname)
  v
[CODA nginx]
  |-- auth_request --> https://emss-labs.fit.nasa.gov/unified-auth/oauth2/auth
  |                        (shared oauth2-proxy, LaunchPad SBX)
  |-- (authed) --> apiv1:3001
```

The shared proxy at `emss-labs.fit.nasa.gov/unified-auth` owns the OIDC
dance with LaunchPad SBX and sets a cookie scoped to `.fit.nasa.gov`. CODA's
nginx asks that proxy "is this session valid?" on every protected request and
gets back the `X-User` / `X-Email` / `X-Auth-Request-Access-Token` headers it
already knows how to use. **CODA's Express code is unchanged.**

---

## Part 1: Shared proxy on `emss-labs.fit.nasa.gov`

This runs once, separately from CODA. It is a small compose stack on the
`emss-labs` host.

### 1.1 Compose file (`/opt/unified-auth/docker-compose.yml`)

```yaml
services:
  nginx:
    image: nginx:1.25-alpine
    restart: always
    ports:
      - "127.0.0.1:8443:443"   # TLS terminates here; HAProxy/host nginx
                                # or direct port-forward punches it out to
                                # emss-labs.fit.nasa.gov:443 under /unified-auth
    volumes:
      - /etc/pki/tls/certs:/etc/pki/tls/certs:ro
      - /etc/pki/tls/private:/etc/pki/tls/private:ro
      - ./nginx.conf:/etc/nginx/nginx.conf:ro

  oauth2-proxy:
    image: quay.io/oauth2-proxy/oauth2-proxy:v7.5.1
    restart: always
    command:
      - --http-address=0.0.0.0:4180
    depends_on:
      - redis
    environment:
      # --- Identity provider (LaunchPad SBX) ---
      OAUTH2_PROXY_PROVIDER: adfs
      OAUTH2_PROXY_OIDC_ISSUER_URL: ${OAUTH2_PROXY_OIDC_ISSUER_URL}
      OAUTH2_PROXY_CLIENT_ID: ${OAUTH2_PROXY_CLIENT_ID}
      OAUTH2_PROXY_CLIENT_SECRET: ${OAUTH2_PROXY_CLIENT_SECRET}
      OAUTH2_PROXY_SKIP_OIDC_DISCOVERY: "true"
      OAUTH2_PROXY_LOGIN_URL: ${OAUTH2_PROXY_LOGIN_URL}
      OAUTH2_PROXY_REDEEM_URL: ${OAUTH2_PROXY_REDEEM_URL}
      OAUTH2_PROXY_OIDC_JWKS_URL: ${OAUTH2_PROXY_OIDC_JWKS_URL}
      OAUTH2_PROXY_EMAIL_DOMAINS: "*"
      OAUTH2_PROXY_OIDC_EMAIL_CLAIM: AUID

      # --- Callback / cookie ---
      # LaunchPad SBX must have this exact URI registered:
      OAUTH2_PROXY_REDIRECT_URL: https://emss-labs.fit.nasa.gov/unified-auth/oauth2/callback
      OAUTH2_PROXY_COOKIE_SECRET: ${OAUTH2_PROXY_COOKIE_SECRET}
      OAUTH2_PROXY_COOKIE_NAME: SESSION
      OAUTH2_PROXY_COOKIE_SAMESITE: lax
      OAUTH2_PROXY_COOKIE_SECURE: "true"
      # Parent-domain cookie so every *.fit.nasa.gov host shares the session:
      OAUTH2_PROXY_COOKIE_DOMAINS: .fit.nasa.gov
      OAUTH2_PROXY_WHITELIST_DOMAIN: .fit.nasa.gov

      # --- Proxy behaviour ---
      OAUTH2_PROXY_REVERSE_PROXY: "true"
      OAUTH2_PROXY_SET_XAUTHREQUEST: "true"
      OAUTH2_PROXY_PASS_ACCESS_TOKEN: "true"
      OAUTH2_PROXY_SKIP_PROVIDER_BUTTON: "true"

      # upstream=file:///dev/null -> proxy does NOT forward requests onward;
      # it only validates sessions and returns headers to the auth_request caller.
      OAUTH2_PROXY_UPSTREAMS: "file:///dev/null"

      # --- Session store ---
      OAUTH2_PROXY_SESSION_STORE_TYPE: redis
      OAUTH2_PROXY_REDIS_CONNECTION_URL: redis://redis

  redis:
    image: redis:7.2.4-alpine3.19
    restart: always
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

> **`OAUTH2_PROXY_UPSTREAMS: file:///dev/null`** is the key knob that makes
> the proxy act as a pure auth-check service rather than a full reverse proxy.
> Requests that pass auth return 202; requests that don't return 401/302.
> The per-app nginx handles the actual `proxy_pass` to the app backend.

### 1.2 nginx config (`/opt/unified-auth/nginx.conf`)

The shared proxy is exposed under the path prefix `/unified-auth/` so it can
share the `emss-labs.fit.nasa.gov` hostname with other things on that host
without conflicting.

```nginx
worker_processes 1;
events { worker_connections 256; }

http {
    server {
        listen 443 ssl;
        server_name emss-labs.fit.nasa.gov;

        ssl_certificate     /etc/pki/tls/certs/nginx.crt;
        ssl_certificate_key /etc/pki/tls/private/nginx.key;
        ssl_protocols       TLSv1.2 TLSv1.3;
        ssl_ciphers         HIGH:!aNULL:!MD5;

        # Strip /unified-auth prefix before forwarding to oauth2-proxy.
        # oauth2-proxy sees paths like /oauth2/auth, /oauth2/callback, etc.
        location /unified-auth/ {
            proxy_pass       http://oauth2-proxy:4180/;
            proxy_set_header Host                    $host;
            proxy_set_header X-Real-IP               $remote_addr;
            proxy_set_header X-Scheme                $scheme;
            proxy_set_header X-Auth-Request-Redirect $scheme://$host$request_uri;
            proxy_set_header Content-Length          "";
            proxy_pass_request_body                  off;
        }

        # The /oauth2/auth sub-location is what nginx auth_request hits.
        # Keeping it separate so Content-Length stripping is always enforced.
        location = /unified-auth/oauth2/auth {
            proxy_pass       http://oauth2-proxy:4180/oauth2/auth;
            proxy_set_header Host             $host;
            proxy_set_header X-Real-IP        $remote_addr;
            proxy_set_header X-Scheme         $scheme;
            proxy_set_header Content-Length   "";
            proxy_pass_request_body           off;
        }
    }
}
```

### 1.3 LaunchPad SBX registration

File a LaunchPad SBX ticket (or use the self-service portal if available) to
register exactly one redirect URI for this shared proxy:

```
https://emss-labs.fit.nasa.gov/unified-auth/oauth2/callback
```

The existing per-app redirect URI for `coda.fit.nasa.gov` (or whichever CODA
test host you use) does **not** need to change — it stays registered
separately as a fallback, but the browser will be directed to the shared
proxy's callback URI during the test.

### 1.4 `.env` for the shared proxy

```
# LaunchPad SBX OIDC endpoints (fill in from LaunchPad team)
OAUTH2_PROXY_OIDC_ISSUER_URL=https://authfs.launchpad-sbx.nasa.gov/...
OAUTH2_PROXY_LOGIN_URL=https://authfs.launchpad-sbx.nasa.gov/.../authorize
OAUTH2_PROXY_REDEEM_URL=https://authfs.launchpad-sbx.nasa.gov/.../token
OAUTH2_PROXY_OIDC_JWKS_URL=https://authfs.launchpad-sbx.nasa.gov/.../jwks

OAUTH2_PROXY_CLIENT_ID=<client-id-registered-for-emss-labs-unified-auth>
OAUTH2_PROXY_CLIENT_SECRET=<client-secret>

# Generate with: python3 -c "import secrets,base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"
OAUTH2_PROXY_COOKIE_SECRET=<32-byte-base64-secret>
```

---

## Part 2: CODA test instance changes

The CODA test instance removes its own oauth2-proxy sidecar and instead
points `auth_request` at the shared proxy. The Express app and all other
containers are unchanged.

### 2.1 Remove the sidecar oauth2-proxy from CODA's compose

In the CODA test environment's `docker-compose.yml` (not this repo's main
file — use a `docker-compose.override.yml` or a separate compose file for the
test deployment), comment out or remove the `oauth2-proxy` and `redis`
services:

```yaml
# docker-compose.test-unified-auth.yml
# Run with: docker compose -f docker-compose.yml -f docker-compose.test-unified-auth.yml up -d

services:
  # Override: disable CODA's own oauth2-proxy and redis.
  # Auth is now handled by emss-labs.fit.nasa.gov/unified-auth.
  oauth2-proxy:
    profiles:
      - disabled   # effective no-op; compose ignores it unless --profile disabled is passed

  redis:
    profiles:
      - disabled
```

> If the CODA nginx container depends on `oauth2-proxy` in the base compose,
> remove that `depends_on` entry in the override as well.

### 2.2 Replace `setup-auth.conf`

CODA's existing `setup-auth.conf` points `auth_request` at the local
`oauth2-proxy` container. Replace the internal container hostname with the
shared proxy's external URL.

Create `docker/nginx/setup-auth-unified.conf`:

```nginx
# Redirect URI bridge: LaunchPad SBX sends the browser back to
# /api/v1/auth/nasalp/adfs/oidc/login on the CODA host.
# We rewrite that to the shared proxy's /oauth2/callback so oauth2-proxy
# can complete the OIDC code exchange and set the shared cookie.
location = /api/v1/auth/nasalp/adfs/oidc/login {
    proxy_pass https://emss-labs.fit.nasa.gov/unified-auth/oauth2/callback;
    proxy_set_header Host emss-labs.fit.nasa.gov;
}

# Expose /oauth2/ so the browser can hit sign-in / sign-out pages hosted
# on the shared proxy (e.g. the redirect-to-LaunchPad page).
location /oauth2/ {
    proxy_pass       https://emss-labs.fit.nasa.gov/unified-auth/oauth2/;
    proxy_set_header Host                    emss-labs.fit.nasa.gov;
    proxy_set_header X-Real-IP               $remote_addr;
    proxy_set_header X-Scheme                $scheme;
    proxy_set_header X-Auth-Request-Redirect $scheme://$host$request_uri;
}

# The auth_request subrequest endpoint on the shared proxy.
location = /oauth2/auth {
    proxy_pass       https://emss-labs.fit.nasa.gov/unified-auth/oauth2/auth;
    proxy_set_header Host             emss-labs.fit.nasa.gov;
    proxy_set_header X-Real-IP        $remote_addr;
    proxy_set_header X-Scheme         $scheme;
    proxy_set_header Content-Length   "";
    proxy_pass_request_body           off;
}

# Logout: forward to the shared proxy's sign_out.
location = /logout {
    proxy_pass https://emss-labs.fit.nasa.gov/unified-auth/oauth2/sign_out;
    proxy_intercept_errors on;
    proxy_set_header Host                    emss-labs.fit.nasa.gov;
    proxy_set_header X-Real-IP               $remote_addr;
    proxy_set_header X-Scheme                $scheme;
    error_page
        301 302 303 304 307 308
        400 401 402 403 404 405 406 408 409 410 411 412 413 414 415 416 421 429
        500 501 502 503 504 505 507
        =200
        /loggedout;
}
```

Then update CODA's `nginx.conf` to include this file instead of
`setup-auth.conf`. Since we don't want to touch the main `nginx.conf` in the
repo, the cleanest approach is to mount the override file at the same path
inside the container:

```yaml
# in docker-compose.test-unified-auth.yml, under services.nginx.volumes:
services:
  nginx:
    volumes:
      # Override the auth setup file only; everything else is baked into the image.
      - ./docker/nginx/setup-auth-unified.conf:/etc/nginx/setup-auth.conf:ro
```

Because the container already has `include setup-auth.conf;` in its
`nginx.conf`, mounting the new file at that same path is enough — no image
rebuild required.

`route-require-auth.conf` is **unchanged**; it still runs `auth_request /oauth2/auth;`
and reads the same `$upstream_http_x_auth_request_*` variables. Those subrequest
responses now come from `emss-labs.fit.nasa.gov/unified-auth` instead of the local
container, but nginx doesn't care about the difference.

### 2.3 CODA's `.env` for the test deployment

Remove or blank the oauth2-proxy-specific variables (they're no longer used):

```bash
# These are no longer needed when using the shared proxy:
# OAUTH2_PROXY_CLIENT_ID=
# OAUTH2_PROXY_CLIENT_SECRET=
# OAUTH2_PROXY_COOKIE_SECRET=
# OAUTH2_PROXY_REDIRECT_URL=
# OAUTH2_PROXY_OIDC_ISSUER_URL=
# ... etc.

# Keep everything else (DB, API keys, Vite env, etc.) unchanged.
```

---

## Part 3: Redirect flow end-to-end

The OIDC redirect chain with the shared proxy looks different from the
per-app flow. Here is every hop:

```
1. Browser -> GET https://coda-test.fit.nasa.gov/
                [no SESSION cookie yet]

2. CODA nginx -> auth_request /oauth2/auth
             -> proxy_pass https://emss-labs.fit.nasa.gov/unified-auth/oauth2/auth
             <- 401

3. CODA nginx -> error_page 401 = /oauth2/sign_in
   Browser   <- 302 /oauth2/sign_in

4. Browser -> GET /oauth2/sign_in
   CODA nginx -> proxy_pass https://emss-labs.fit.nasa.gov/unified-auth/oauth2/sign_in
   shared proxy <- (generates LaunchPad redirect URL, callback=emss-labs/unified-auth/oauth2/callback)
   Browser <- 302 https://authfs.launchpad-sbx.nasa.gov/...?redirect_uri=
                    https://emss-labs.fit.nasa.gov/unified-auth/oauth2/callback
                    &state=<encoded-return-url>

5. Browser -> LaunchPad SBX (user authenticates)
   LaunchPad <- 302 https://emss-labs.fit.nasa.gov/unified-auth/oauth2/callback?code=...

6. Browser -> GET https://emss-labs.fit.nasa.gov/unified-auth/oauth2/callback?code=...
   shared proxy redeems code, sets Set-Cookie: SESSION=...; Domain=.fit.nasa.gov
   Browser <- 302 https://coda-test.fit.nasa.gov/  (the original URL from &state=)

7. Browser -> GET https://coda-test.fit.nasa.gov/
                [SESSION cookie now present, Domain=.fit.nasa.gov]
   CODA nginx -> auth_request /oauth2/auth
             -> proxy_pass https://emss-labs.fit.nasa.gov/unified-auth/oauth2/auth
             <- 202 + X-Auth-Request-User / X-Auth-Request-Email / X-Auth-Request-Access-Token
   CODA nginx -> proxy_pass http://apiv1:3001  [with X-User / X-Email / X-Access-Token headers]
   Browser <- 200 CODA app
```

**Key observation at step 6:** the browser briefly lands on
`emss-labs.fit.nasa.gov` to complete the callback. That is unavoidable —
the OIDC code is sent to the redirect URI registered with LaunchPad, which
must be the shared proxy's host. The user sees it for one redirect (no page
render) before being sent back to the CODA host. This is the same behaviour
as any multi-domain SSO flow.

---

## Part 4: Acceptance tests

Run these manually after bringing the test stack up.

| # | Test | Expected result |
|---|------|-----------------|
| 1 | Open `https://coda-test.fit.nasa.gov` in a clean private window | Redirected through LaunchPad SBX; lands on CODA after authenticating |
| 2 | Check `document.cookie` in the browser console | `SESSION` cookie present with `Domain=.fit.nasa.gov` |
| 3 | In the same browser tab, open `https://emss-labs.fit.nasa.gov/unified-auth/oauth2/userinfo` | Returns JSON for the already-logged-in user (no second LaunchPad redirect) |
| 4 | In a new tab (same window), open a second `*.fit.nasa.gov` test app if available | No second LaunchPad login; `SESSION` cookie sent automatically |
| 5 | Click the CODA logout link (`/logout`) | Session cleared; redirected to LaunchPad SBX logout |
| 6 | After logout, reload CODA | Redirected to LaunchPad SBX sign-in again |

---

## Part 5: What is NOT changed

- **`route-require-auth.conf`** — no changes. It still does `auth_request /oauth2/auth` and reads the same variable set.
- **`nginx.conf`** — no changes. The mount override in step 2.2 replaces just the auth-setup include.
- **`src/` (Express, React)** — no changes. `getUserFromJWT` in `src/packages/getUser.ts` reads the same headers.
- **Database, migrations, seeds** — no changes.
- **Other CODA services** (apiv1, database, redis for app data) — redis is removed only from the auth sidecar; CODA's own redis (if used for other things) is unaffected. If the app currently relies on the compose `redis` for session storage only, removing it is safe.

---

## Part 6: Rollback

To revert to per-app auth:

1. Remove the `docker-compose.test-unified-auth.yml` override (stop passing `-f` to compose).
2. The original `setup-auth.conf` is restored automatically (it was never changed in the image or repo).
3. Bring `oauth2-proxy` and `redis` back up in the base compose.

The only persistent artifact is the `.fit.nasa.gov`-scoped `SESSION` cookie in users' browsers. It expires naturally (or they can clear cookies). It does not conflict with the per-app cookie because both use the same cookie name (`SESSION`) and the browser will use the domain-widest match — once the shared proxy is gone the narrower per-app cookie takes over on next login.

---

## Open questions before running the test

1. **SSL cert on `emss-labs.fit.nasa.gov`** — does the host already have a wildcard or SAN cert covering it? The shared proxy nginx needs a valid cert for browsers and for CODA's nginx `proxy_pass https://` to trust it.
2. **LaunchPad SBX client registration** — who files the ticket? The redirect URI (`https://emss-labs.fit.nasa.gov/unified-auth/oauth2/callback`) must be registered before the first login attempt.
3. **CODA test hostname** — what DNS name is the test CODA instance on? Steps above use `coda-test.fit.nasa.gov` as a placeholder.
4. **Network access** — can the CODA nginx container reach `emss-labs.fit.nasa.gov:443` on the internal network? The `proxy_pass https://emss-labs.fit.nasa.gov/unified-auth/...` calls go out from the nginx container, so it needs outbound HTTPS to that host.
5. **Cookie blast radius** — list other services already running on `*.fit.nasa.gov` that might start receiving the `SESSION` cookie unexpectedly. They won't be broken by receiving an extra cookie, but the audit is worth doing before widening to production.
