# When building via kaniko in CI, the dependency proxy will cache image from Docker Hub.
# For local builds, Docker pulls directly from Docker Hub

# # # # # # # #
# BASE image  #
# # # # # # # #

# This build doesn't actually need the "AS base" except that it simplifies our .gitlab-ci.yml by
# allowing us to specify `--target base`
#
# We use openresty (nginx + LuaJIT + ngx_http_lua_module) instead of stock
# nginx:alpine because the @error401 named location needs `ngx.escape_uri` to
# percent-encode the original request URL before sticking it in the rd= query
# param sent to oauth2-proxy/sign_in. Without proper URL-encoding, unencoded
# `&` in the original URL truncates rd on the oauth2-proxy side (Go's
# req.Form.Get("rd") splits on `&`). Stock nginx has no urlencode primitive
# for $request_uri, so the choices are openresty (Lua) or the set-misc-nginx-module.
# openresty is the smaller change — same nginx binary, same configs, just
# with the Lua module compiled in.
#
# openresty's default paths differ from stock nginx; symlink the conf and html
# dirs so all our existing COPY targets (/etc/nginx/*, /usr/share/nginx/html)
# and docker-compose mounts keep working without changing every reference.
FROM openresty/openresty:1.27.1.2-alpine AS base

# The openresty base image doesn't create an `nginx` user (it runs as `nobody`
# by default), but nginx.conf has `user nginx;` baked in. Create the user/group
# so the existing config keeps working without edits.
RUN addgroup -S nginx \
    && adduser -S -D -H -G nginx -s /sbin/nologin nginx

# openresty's nginx is compiled with --prefix=/usr/local/openresty/nginx so it
# loads its config from /usr/local/openresty/nginx/conf/nginx.conf, not from
# /etc/nginx/nginx.conf. The openresty image also ships a /etc/nginx directory
# containing an `include /etc/nginx/conf.d/*.conf` chain (with a default
# server on port 80) that would shadow our config.
#
# Remove /etc/nginx entirely and replace it with a symlink to openresty's real
# conf dir, so that the existing `COPY /docker/nginx/*.conf /etc/nginx/...`
# steps below land in the path nginx actually reads. Same idea for the html
# dir so docker-compose volume mounts and `root /usr/share/nginx/html;` keep
# working.
RUN rm -rf /etc/nginx /usr/share/nginx/html \
    && mkdir -p /etc /usr/share/nginx \
    && ln -sfn /usr/local/openresty/nginx/conf /etc/nginx \
    && ln -sfn /usr/local/openresty/nginx/html /usr/share/nginx/html

# nginx.conf references /var/log/nginx/{access,error}.log; openresty's image
# logs to /usr/local/openresty/nginx/logs. Create /var/log/nginx so the paths
# baked into nginx.conf keep working.
RUN mkdir -p /var/log/nginx

# `envsubst` (from gettext) is needed by docker-entrypoint.sh to render
# setup-auth-unified.conf from its .template at container start, substituting
# ${AUTH_HOST} with the env var value. ~150 KB installed.
RUN apk add --no-cache gettext

# Ensure images directory exists.
RUN mkdir -p /usr/share/nginx/static

# # # # # # # # #
# BUILDER image #
# # # # # # # # #

### Build the React client
FROM node:24.11.1-alpine3.23 AS builder

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
COPY /docker/nginx/setup-auth.conf /etc/nginx/setup-auth.conf
# setup-auth-unified.conf is RENDERED AT CONTAINER START from this template by
# docker-entrypoint.sh, which envsubst's the AUTH_HOST env var into it. The
# rendered file lands at /etc/nginx/setup-auth-unified.conf and is what
# nginx.conf includes.
COPY /docker/nginx/setup-auth-unified.conf.template /etc/nginx/setup-auth-unified.conf.template
COPY /docker/nginx/route-require-auth.conf /etc/nginx/route-require-auth.conf
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
