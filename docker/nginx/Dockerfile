# When building via kaniko in CI, the dependency proxy will cache image from Docker Hub.
# For local builds, Docker pulls directly from Docker Hub

# # # # # # # #
# BASE image  #
# # # # # # # #

# This build doesn't actually need the "AS base" except that it simplifies our .gitlab-ci.yml by
# allowing us to specify `--target base`
FROM nginx:1.30.4-alpine AS base

# njs provides ngx_http_js_module for URL-encoding in the @error401 named
# location (docker/nginx/rd.js + js_set in nginx.conf). Stock nginx has no
# urlencode primitive for $request_uri; njs encodeURIComponent handles it
# without a base-image swap.
# gettext provides envsubst, used by docker-entrypoint.sh to render
# setup-auth-unified.conf with AUTH_HOST at container start.
# Versions pinned to the apk packages bundled with nginx:1.30.4-alpine.
# - nginx-mod-http-js is pinned exactly (including the -rN revision) because
#   its .so is built against this exact nginx build; an unpinned or mismatched
#   version can fail to load or ABI-mismatch at startup.
# - gettext is pinned only because apk requires an exact version plus revision
#   to resolve a `pkg=version` constraint. It is not ABI-sensitive like njs;
#   it just needs to exist in the selected Alpine release. Both pins must be
#   re-checked and bumped with the nginx base image.
RUN apk add --no-cache nginx-mod-http-js=1.30.4-r1 gettext=1.0-r0

# Ensure images directory exists.
RUN mkdir -p /usr/share/nginx/static

# # # # # # # # #
# BUILDER image #
# # # # # # # # #

### Build the React client
FROM node:24.19.0-alpine3.23 AS builder

RUN mkdir /clientsrc
WORKDIR /clientsrc

# Prepare for build
RUN pwd
COPY package*.json ./
RUN npm ci

# copy the rest of the files.
# Will not copy the .env file due to .dockerignore. This is desirable because we technically want to
# keep images environmentally agnostic as possible
COPY . /clientsrc

# All VITE_PUBLIC* environment variables need to be present at build time, because they
# are actually inserted into the client-side code. Aka, any .env variable that we need
# at build time must be explicitly listed here. The "ARG" command is the docker file saying
# "we accept this variable". If you don't list it, it will be un-set at build.
#
# The .env file is not copied over, so these variables must be sent in another way. In the pipeline
# these are sent in as build args through the docker build command (kaniko). Locally, these are sent in
# via docker-compose build:args: property.
ARG VITE_PUBLIC_MAPBOX_KEY
ARG VITE_PUBLIC_TALKYBOT_URL
ARG VITE_PUBLIC_LIVE_STREAMS_ENABLED
ARG VITE_PUBLIC_MEDIA_MTX_CONTROL_URL
ARG VITE_PUBLIC_MEDIA_MTX_HLS_URL
ARG VITE_PUBLIC_MEDIA_MTX_RECORDINGS_URL
ARG VITE_PUBLIC_MTX_VIDEO_MAX_AGE_DAYS
ARG VITE_PUBLIC_MAPLIBRE_BASE_URL
ARG VITE_PUBLIC_MAPLIBRE_PMTILES_FILENAME

# Make GIT_COMMIT available inside docker/kaniko so it can be baked into the code at build time
# The GIT_COMMIT value is passed in using MAP_ENV_VARS_TO_BUILD_ARGS from the job pipeline.
# When building this container locally, this is not available so "localDev" will be used as default value
ARG GIT_COMMIT=localDev
ENV GIT_COMMIT=$GIT_COMMIT

# Build the React client
RUN npm run vite:build

# # # # # # # #
# PROD image  #
# # # # # # # #

# This build doesn't actually need the "AS base" except that it simplifies our .gitlab-ci.yml by
# allowing us to specify `--target base`
FROM base AS prod

# Clear out the default nginx files
RUN rm -rf /usr/share/nginx/html/*

# Copy built files to nginx root
COPY --from=builder /clientsrc/.local/vite/dist /usr/share/nginx/html

# Nginx config files
COPY /docker/nginx/nginx.conf /etc/nginx/nginx.conf
# setup-auth-unified.conf is RENDERED AT CONTAINER START from this template by
# docker-entrypoint.sh, which envsubst's the AUTH_HOST env var into it. The
# rendered file lands at /etc/nginx/setup-auth-unified.conf and is what
# nginx.conf includes. route-require-auth.conf is rendered too, to insert
# AUTH_COOKIE_NAME without expanding nginx's own variables.
COPY /docker/nginx/setup-auth-unified.conf.template /etc/nginx/setup-auth-unified.conf.template
COPY /docker/nginx/route-require-auth.conf /etc/nginx/route-require-auth.conf.template
COPY /docker/nginx/rd.js /etc/nginx/rd.js
# COPY /docker/nginx/*.conf /etc/nginx/*.conf

COPY ./docker/nginx/loggedout.html /usr/share/nginx/html/
COPY ./docker/nginx/loggedin.html /usr/share/nginx/html/

# Entrypoint renders the unified-auth template, then exec's CMD.
COPY ./docker/nginx/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]

# This image is intended to be run with docker-compose. See docker-compose*.yml files for necessary
# environment variables
CMD ["nginx", "-g", "daemon off;"]
