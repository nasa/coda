#!/bin/sh
# Renders /etc/nginx/setup-auth-unified.conf from its .template by substituting
# the AUTH_HOST env var, then exec's nginx.
#
# Why a template?
#   AUTH_HOST is the hostname of the shared oauth2-proxy this app delegates
#   auth_request to. Today every environment points at emss-labs.fit.nasa.gov
#   (LaunchPad SBX), but the value is per-deploy (e.g. emss-prod.fit.nasa.gov
#   for a future prod-LaunchPad-backed shared proxy). Baking it into the image
#   at build time would force a rebuild to switch; reading it at container
#   start lets the same image work in any environment.
#
# Why envsubst with a quoted variable list?
#   envsubst with no args substitutes EVERY $VAR / ${VAR} it finds, which
#   would clobber nginx's own $remote_addr, $http_host, $scheme, etc.
#   Passing the explicit list '${AUTH_HOST}' tells envsubst to only touch
#   that one name and leave every other $... alone.

set -eu

# This file INTENTIONALLY replaces the base nginx image's own /docker-entrypoint.sh
# (see the Dockerfile's `COPY .../docker-entrypoint.sh /docker-entrypoint.sh`), so
# the stock /docker-entrypoint.d/*.sh init scripts never run. That's safe for CODA:
#   - 30-tune-worker-processes.sh only acts when NGINX_ENTRYPOINT_WORKER_PROCESSES_AUTOTUNE
#     is set (we don't set it), and even then it would just rewrite worker_processes
#     to a number — nginx.conf already sets `worker_processes auto;` directly, which
#     is the same outcome.
#   - 20-envsubst-on-templates.sh only touches files under /etc/nginx/templates, which
#     CODA doesn't populate (our template lives at
#     /etc/nginx/setup-auth-unified.conf.template and is rendered below instead).
#   - 10-listen-on-ipv6-by-default.sh only edits /etc/nginx/conf.d/default.conf, which
#     doesn't exist in this image (nginx.conf is replaced wholesale and never
#     includes conf.d).
#   - 15-local-resolvers.envsh only matters for templates that reference the Docker
#     embedded DNS resolver, which none of ours do.
# (Verified against nginx:1.30.2-alpine3.23, the base image pinned in the Dockerfile.)
# If the base image is ever bumped, re-check /docker-entrypoint.d/ for new scripts.

: "${AUTH_HOST:?AUTH_HOST env var is required (set in .env via env.config.ts)}"

TEMPLATE=/etc/nginx/setup-auth-unified.conf.template
OUTPUT=/etc/nginx/setup-auth-unified.conf

if [ -f "$TEMPLATE" ]; then
    echo "[docker-entrypoint] Rendering $OUTPUT from $TEMPLATE (AUTH_HOST=$AUTH_HOST)"
    envsubst '${AUTH_HOST}' < "$TEMPLATE" > "$OUTPUT"
else
    echo "[docker-entrypoint] WARNING: $TEMPLATE not found; leaving $OUTPUT as-is."
fi

exec "$@"
