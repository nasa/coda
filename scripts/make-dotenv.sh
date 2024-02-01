#!/bin/sh
#
# Creates .env file from .env.template and .env.secret

set -eu

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

RELATIVE_DOTENV_SECRET=".env.secret"
DOTENV_SECRET="${SCRIPT_DIR}/../${RELATIVE_DOTENV_SECRET}";
# Get values from .env.secret (if exists)
if [ -f "${DOTENV_SECRET}" ]; then
    source "${DOTENV_SECRET}"
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

# Set all the other variables for the .env file
if [ -z "${CI+set}" ]; then # if not in CI (aka local)
    export DOCKER_HOST_SSL_CERTS_DIR=./.local/certs
    export DOCKER_HOST_SSL_PRIVATE_DIR=./.local/private
    export DOCKER_HOST_HTTP_STATIC_DIR=./.local/static
    export IMAGE_VERSION=local
    export CACHE_ROOT=./.cache/dev
else
    export DOCKER_HOST_SSL_CERTS_DIR=/etc/pki/tls/certs
    export DOCKER_HOST_SSL_PRIVATE_DIR=/etc/pki/tls/private
    export DOCKER_HOST_HTTP_STATIC_DIR=/d1/coda/static
    # ${IMAGE_VERSION} is prod, int, or dev as defined/exported in the make-dotenv job in pipeline
    export IMAGE_VERSION=${IMAGE_VERSION}
    export CACHE_ROOT=/d1/coda/cache
fi

# Actual FIT environments deployed by GitLab CI the CACHE_ROOT needs to be relative
# for tests run in GitLab CI.
set +u
if [ "${1}" == "test" ]; then
    export  CACHE_ROOT=./.cache/test
fi
set -u

# Fill in all the variables into the .env file
# envsubst must be installed. Installed by default in Git Bash for Windows.
# Do `apk add --update --no-cache gettext` on Alpine.
# Variables set above will not be picked up by envsubst if not exported
cat "${SCRIPT_DIR}/../.env.template" | envsubst > "${SCRIPT_DIR}/../.env"

echo ".env successfully created"
