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
