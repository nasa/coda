# # # # # # # #
# IMAGE: base #
# # # # # # # #

# Get the base image, which is supplied by the pipeline. If the *_BASE_IMAGE value is not defined
#   (which is true when building locally) then use the value to the right of the = operator
ARG NEXTJS_BASE_IMAGE=node:20.11.0-alpine

FROM $NEXTJS_BASE_IMAGE as base
RUN mkdir /app
WORKDIR /app
COPY package*.json ./


# CODA requires a special CA-cert in place to talk to Imagery Online...maybe. Try removing this.
COPY .env.local.cert.pem /
ENV NODE_EXTRA_CA_CERTS=/.env.local.cert.pem

RUN dos2unix /.env.local.cert.pem

# # # # # # # #
# IMAGE: prod #
# # # # # # # #

FROM base as prod

# Ultimately should set `ENV NODE_ENV=production` prior to running install, so npm
# doesn't install devDependencies. Also consider --no-optional. However, since the
# `npm run build` step requires devDependencies to be able to do the build, we'll
# need a multi-stage build or explicitly remove the devDependencies after build.
RUN npm install

# Copy the rest of the app code over to the image, but only in prod. In dev, the app code will be
# mounted as a volume from the host.
COPY . /app

# WARNING: All NEXT_PUBLIC_* environment variables need to be present at build time, because they
# are actually inserted into the client-side code. Here we're baking these values into the image,
# which isn't ideal, but if we don't bake them in then we'd have to pass them at runtime, which
# means we'd have to run `npm run build` at runtime, which is worse. Alternatively, we could make
# it so there are no NEXT_PUBLIC_* env vars, and instead retrieve config currently in NEXT_PUBLIC_*
# env vars via another method (e.g. having an API endpoint for config).
ARG NEXT_PUBLIC_MAPBOX_KEY
ARG NEXT_PUBLIC_APP_ENV
ARG IMAGE_VERSION

RUN npm run build \
  && rm -f ./.env

# runs on port 3000
CMD ["/bin/sh", "-c", "npm run start"]


# # # # # # # #
# IMAGE: dev  #
# # # # # # # #

FROM base as dev

ENV NODE_ENV=development

# runs on port 3000
# Dev runs `npm i` at container start. Prod build doesn't.
CMD ["/bin/sh", "-c", "npm i; npm run dev"]
