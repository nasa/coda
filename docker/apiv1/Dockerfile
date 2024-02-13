# Get the base image, which is supplied by the pipeline. If the *_BASE_IMAGE value is not defined
#   (which is true when building locally) then use the value to the right of the = operator
# Base image optionally from arg
# ref: https://eegitlab.fit.nasa.gov/emss/docs/-/blob/main/docker.md#base-images-as-arg
ARG APIV1_BASE_IMAGE=node:20.11.0-alpine

# # # # # # # #
# BASE image  #
# # # # # # # #
FROM $APIV1_BASE_IMAGE as base

# CODA requires a special CA-cert in place to talk to Imagery Online...maybe. Try removing this.
# Do we need this since this is happening in the pipeline build template before_script?
COPY .env.local.cert.pem /
ENV NODE_EXTRA_CA_CERTS=/.env.local.cert.pem

RUN dos2unix /.env.local.cert.pem

# Set the environment to production so that dev dependencies are not installed and express is optimized for production performance
ENV NODE_ENV production

# # # # # # # # # # # # # # # # #
# BUILDER image for production  #
# # # # # # # # # # # # # # # # #
# Put these steps in a different stage since we don't need node modules in the prod image. All we need is the final built api.js file
FROM base AS builder

RUN mkdir /serverbuild
WORKDIR /serverbuild

COPY package*.json .
RUN npm install

COPY . /serverbuild
RUN npm run api:build

# # # # # # # #
# PROD image  #
# # # # # # # #
FROM base AS prod
RUN mkdir /app
WORKDIR /app

# Copy build file
COPY --from=builder /serverbuild/.local/express/dist/api.js /app

# This image is intended to be run with docker-compose. See docker-compose.dev.yml for necessary
# environment variables
CMD "node" "/app/api.js"