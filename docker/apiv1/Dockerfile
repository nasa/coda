# When building via kaniko in CI, the dependency proxy will cache image from Docker Hub.
# For local builds, Docker pulls directly from Docker Hub

# # # # # # # #
# PROD image  #
# # # # # # # #
FROM node:24.11.1-alpine3.23 AS prod

# CODA requires a special CA-cert in place to talk to Imagery Online.
COPY .env.local.cert.pem /
ENV NODE_EXTRA_CA_CERTS=/.env.local.cert.pem

RUN mkdir /app
WORKDIR /app

# Make GIT_COMMIT available inside docker/kaniko so it can be baked into the code at build time
# The GIT_COMMIT value is passed in using MAP_ENV_VARS_TO_BUILD_ARGS from the job pipeline.
# When building this container locally, this is not available so "localDev" will be used as default value
ARG GIT_COMMIT=localDev
ENV GIT_COMMIT=$GIT_COMMIT

COPY package*.json .
RUN npm ci

# copy the rest of the files
COPY . /app

RUN npm run api:build

# Set NODE_ENV to production for the production image
# This enables Express production mode (better error handling, performance optimizations)
ENV NODE_ENV="production"
ENV NODE_OPTIONS="--max-old-space-size-percentage=75"

# This image is intended to be run with docker-compose.
CMD ["/bin/sh", "-c", "npm run migration:up; npm run api:prod"]
