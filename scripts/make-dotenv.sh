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
    DOCKER_HOST_SSL_CERTS_DIR=./.local/certs
    DOCKER_HOST_SSL_PRIVATE_DIR=./.local/private
    DOCKER_HOST_HTTP_STATIC_DIR=./.local/static
    IMAGE_VERSION="local"
    CACHE_ROOT=./.cache/dev

    NGINX_BASE_IMAGE=nginx:1.23.0-alpine
    NEXTJS_BASE_IMAGE=node:18-alpine
else
    DOCKER_HOST_SSL_CERTS_DIR=/etc/pki/tls/certs
    DOCKER_HOST_SSL_PRIVATE_DIR=/etc/pki/tls/private
    DOCKER_HOST_HTTP_STATIC_DIR=/d1/coda/static
    IMAGE_VERSION="${IMAGE_VERSION}"
    CACHE_ROOT=/d1/coda/cache

    NGINX_BASE_IMAGE=eegitlabregistry.fit.nasa.gov/emss/docker-images/nginx:1.23.0-alpine
    NEXTJS_BASE_IMAGE=eegitlabregistry.fit.nasa.gov/emss/docker-images/node:18-alpine
fi

# Actual FIT environments deployed by GitLab CI have different requirement for CACHE_ROOT
# than tests run in GitLab CI.
if [ "${1}" = "test" ]; then
    CACHE_ROOT=./.cache/test
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

# Variables set above will not be picked up by envsubst if not exported
export DOCKER_HOST_SSL_CERTS_DIR \
    DOCKER_HOST_SSL_PRIVATE_DIR \
    DOCKER_HOST_HTTP_STATIC_DIR \
    IMAGE_VERSION \
    NGINX_BASE_IMAGE \
    NEXTJS_BASE_IMAGE \
    CACHE_ROOT

# envsubst must be installed. Installed by default in Git Bash for Windows.
# Do `apk add --update --no-cache gettext` on Alpine.
cat "${SCRIPT_DIR}/../.env.template" | envsubst > "${SCRIPT_DIR}/../.env"

echo ".env successfully created"
