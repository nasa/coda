#!/bin/sh
#
# Creates .env file from .env.template and .env.secret

if [ -z "${1}" ]; then
    echo "Specify either 'fit', 'local', or 'test' as first param of this script"
    exit 1
fi

set -eu

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

RELATIVE_DOTENV_SECRET=".env.secret"
DOTENV_SECRET="${SCRIPT_DIR}/../${RELATIVE_DOTENV_SECRET}";
if [ -f "${DOTENV_SECRET}" ]; then
    source "${DOTENV_SECRET}"
fi

if [ "${1}" = "local" ]; then
    export DOCKER_HOST_SSL_CERTS_DIR=./.local/certs
    export DOCKER_HOST_SSL_PRIVATE_DIR=./.local/private
    export DOCKER_HOST_HTTP_STATIC_DIR=./.local/static
    export IMAGE_VERSION="local"
    export CACHE_ROOT=./.cache/dev

    export NGINX_BASE_IMAGE=nginx:1.23.0-alpine
    export NEXTJS_BASE_IMAGE=node:20.11.0-alpine
else
    export DOCKER_HOST_SSL_CERTS_DIR=/etc/pki/tls/certs
    export DOCKER_HOST_SSL_PRIVATE_DIR=/etc/pki/tls/private
    export DOCKER_HOST_HTTP_STATIC_DIR=/d1/coda/static
    export IMAGE_VERSION="${IMAGE_VERSION}"
    export CACHE_ROOT=/d1/coda/cache

    export NGINX_BASE_IMAGE=eegitlabregistry.fit.nasa.gov/emss/docker-images/nginx:1.23.0-alpine
    export NEXTJS_BASE_IMAGE=eegitlabregistry.fit.nasa.gov/emss/docker-images/node:20.11.0-alpine
fi

# Actual FIT environments deployed by GitLab CI have different requirement for CACHE_ROOT
# than tests run in GitLab CI.
if [ "${1}" = "test" ]; then
    export  CACHE_ROOT=./.cache/test
fi

# Allow unset variables below, so it can create a blank .env.secret
set +u

# Required values that will get cached, so subsequent runs of make-dotenv.sh can reuse them
echo "export IO_KEY=${IO_KEY@Q}
export WIKI_USER=${WIKI_USER@Q}
export WIKI_PASSWORD=${WIKI_PASSWORD@Q}
export SPACETRACK_USER=${SPACETRACK_USER@Q}
export SPACETRACK_PASSWORD=${SPACETRACK_PASSWORD@Q}
export NEXT_PUBLIC_MAPBOX_KEY=${NEXT_PUBLIC_MAPBOX_KEY@Q}
export TOPO_USER=${TOPO_USER@Q}
export TOPO_PASSWORD=${TOPO_PASSWORD@Q}" > "${DOTENV_SECRET}"

set -u

echo "${RELATIVE_DOTENV_SECRET} saved"

# envsubst must be installed. Installed by default in Git Bash for Windows.
# Do `apk add --update --no-cache gettext` on Alpine.
# Variables set above will not be picked up by envsubst if not exported
cat "${SCRIPT_DIR}/../.env.template" | envsubst > "${SCRIPT_DIR}/../.env"

echo ".env successfully created"
