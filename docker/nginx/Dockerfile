# Get the base image, which is supplied by the pipeline. If the *_BASE_IMAGE value is not defined
#   (which is true when building locally) then use the value to the right of the = operator
# hadolint global ignore=DL3006
ARG NGINX_BASE_IMAGE=nginx:1.28.0-alpine
ARG NODE_BASE_IMAGE=node:24.11.1-alpine

# # # # # # # #
# BASE image  #
# # # # # # # #

# This build doesn't actually need the "AS base" except that it simplifies our .gitlab-ci.yml by
# allowing us to specify `--target base`
FROM $NGINX_BASE_IMAGE AS base

# Ensure images directory exists.
RUN mkdir -p /usr/share/nginx/static

# # # # # # # # #
# BUILDER image #
# # # # # # # # #

### Build the React client
FROM $NODE_BASE_IMAGE AS builder

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
ARG VITE_PUBLIC_LIVE_STREAMS_ENABLED
ARG VITE_PUBLIC_MEDIA_MTX_CONTROL_URL
ARG VITE_PUBLIC_MEDIA_MTX_HLS_URL
ARG VITE_PUBLIC_MEDIA_MTX_RECORDINGS_URL
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
COPY /docker/nginx/route-require-auth.conf /etc/nginx/route-require-auth.conf
# COPY /docker/nginx/*.conf /etc/nginx/*.conf

COPY ./docker/nginx/loggedout.html /usr/share/nginx/html/
COPY ./docker/nginx/loggedin.html /usr/share/nginx/html/

# This image is intended to be run with docker-compose. See docker-compose*.yml files for necessary
# environment variables
CMD ["nginx", "-g", "daemon off;"]
