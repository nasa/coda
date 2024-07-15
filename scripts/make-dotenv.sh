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

# Generate passwords if there wern't any sourced from the .env.secret
if [ -z "${DB_PASS+set}" ]; then
    export DB_PASS=$(tr -c -d '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' </dev/urandom | dd bs=32 count=1 2>/dev/null;echo)
fi

# Allow unset variables below, so it can create a blank .env.secret
set +u

# Required values that will get cached, so subsequent runs of make-dotenv.sh can reuse them
echo "export IO_KEY=${IO_KEY@Q}
export WIKI_USER=${WIKI_USER@Q}
export WIKI_PASSWORD=${WIKI_PASSWORD@Q}
export SPACETRACK_USER=${SPACETRACK_USER@Q}
export SPACETRACK_PASSWORD=${SPACETRACK_PASSWORD@Q}
export VITE_PUBLIC_MAPBOX_KEY=${VITE_PUBLIC_MAPBOX_KEY@Q}
export TOPO_USER=${TOPO_USER@Q}
export TOPO_PASSWORD=${TOPO_PASSWORD@Q}
export DB_PASS=${DB_PASS@Q}
" > "${DOTENV_SECRET}"

set -u

echo "${RELATIVE_DOTENV_SECRET} saved"

# Set all the other variables for the .env file
if [ -z "${CI+set}" ]; then # if not in CI (aka local)
    export DOCKER_HOST_SSL_CERTS_DIR=./.local/certs
    export DOCKER_HOST_SSL_PRIVATE_DIR=./.local/private
    export DOCKER_HOST_HTTP_STATIC_DIR=./.local/static
    export CACHE_ROOT=./.cache/dev
    export TALKYBOT_URL=https://emss-labs-local.fit.nasa.gov

    export DOCKER_DB_DATA_DIR=./.local/database
    export DOCKER_DB_INIT_DIR=./.local/db-init

    # DB_HOST is "localhost" when doing native/local Node development. When running
    #   node in docker in docker:preview, this will be overridden in the 
    #   docker-compose-preview.yml to be "database"
    export DB_HOST=localhost
    # Use a different port for local development to avoid conflicts with other apps
    #   when doing dev in docker:services mode
    export DB_PORT=5431 

    # These values are not used locally since the docker-compose is overriden by
    #   the docker-compose.preview files. Those files build the images directly from the Dockerfiles
    export DOCKER_IMAGE_NGINX=NOT_USED_LOCALLY
    export DOCKER_IMAGE_APIV1=NOT_USED_LOCALLY
else
    export DOCKER_HOST_SSL_CERTS_DIR=/etc/pki/tls/certs
    export DOCKER_HOST_SSL_PRIVATE_DIR=/etc/pki/tls/private
    export DOCKER_HOST_HTTP_STATIC_DIR=/d1/coda/static
    export CACHE_ROOT=/d1/coda/cache
    export TALKYBOT_URL=https://coda-dev2.fit.nasa.gov

    export DOCKER_DB_DATA_DIR=/d1/coda/postgres
    export DOCKER_DB_INIT_DIR=/d1/coda/db-init

    export DB_HOST=database
    export DB_PORT=5432

    # IMAGE_VERSION is defined in the pipeline job
    export DOCKER_IMAGE_NGINX="eegitlabregistry.fit.nasa.gov/emss/coda/nginx:${IMAGE_VERSION}";
    export DOCKER_IMAGE_APIV1="eegitlabregistry.fit.nasa.gov/emss/coda/apiv1:${IMAGE_VERSION}";
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
