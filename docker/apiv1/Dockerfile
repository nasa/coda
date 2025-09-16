# Get the base image, which is supplied by the pipeline. If the *_BASE_IMAGE value is not defined
#   (which is true when building locally) then use the value to the right of the = operator
# Base image optionally from arg
# ref: https://eegitlab.fit.nasa.gov/emss/docs/-/blob/main/docker.md#base-images-as-arg
# hadolint global ignore=DL3006
ARG APIV1_BASE_IMAGE=node:22.18.0-alpine

# # # # # # # #
# PROD image  #
# # # # # # # #
FROM $APIV1_BASE_IMAGE AS prod

# CODA requires a special CA-cert in place to talk to Imagery Online.
COPY .env.local.cert.pem /
ENV NODE_EXTRA_CA_CERTS=/.env.local.cert.pem

RUN mkdir /app
WORKDIR /app

COPY package*.json .
RUN npm ci

# copy the rest of the files
COPY . /app

RUN npm run api:build

# This image is intended to be run with docker-compose.
CMD ["/bin/sh", "-c", "npm run migration:up; npm run api:prod"]
