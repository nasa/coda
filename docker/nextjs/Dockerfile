# # # # # # # #
# IMAGE: base #
# # # # # # # #

# Must have base image, which is supplied by docker-compose, defined in .env, and
# set appropriately for the environment via scripts/make-dotenv.sh
ARG NEXTJS_BASE_IMAGE

FROM $NEXTJS_BASE_IMAGE as base
RUN mkdir /app
WORKDIR /app
COPY package*.json ./
COPY docker/nextjs/docker-entrypoint.sh /

# CODA requires a special CA-cert in place to talk to Imagery Online...maybe. Try removing this.
COPY .env.local.cert.pem /
ENV NODE_EXTRA_CA_CERTS=/.env.local.cert.pem

RUN dos2unix /docker-entrypoint.sh && \
  chmod +x /docker-entrypoint.sh && \
  dos2unix /.env.local.cert.pem
ENTRYPOINT [ "/docker-entrypoint.sh" ]


# # # # # # # #
# IMAGE: prod #
# # # # # # # #


FROM base as prod

# Prod build doesn't run `npm i` at container start. Dev does. See docker-entrypoint.sh
ENV RUN_NPM_INSTALL_ON_START=no

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
# means we'd have to run `npm run bulid` at runtime, which is worse. Alternatively, we could make
# it so there are no NEXT_PUBLIC_* env vars, and instead retrieve config currently in NEXT_PUBLIC_*
# env vars via another method (e.g. having an API endpoint for config).
ARG NEXT_PUBLIC_MAPBOX_KEY
ARG NEXT_PUBLIC_APP_ENV
ARG IMAGE_VERSION

RUN npm run build \
  && rm -f ./.env

# runs on port 3000
# was this for DB setup: CMD ["/bin/sh", "-c", "npm run migrate:up; npm run start"]
CMD ["/bin/sh", "-c", "npm run start"]


# # # # # # # #
# IMAGE: dev  #
# # # # # # # #


FROM base as dev

# Prod build doesn't run `npm i` at container start. Dev does. See docker-entrypoint.sh
ENV RUN_NPM_INSTALL_ON_START=yes

ENV NODE_ENV=development

# Note: does not run `npm install`. That's done at runtime for dev, so it can be saved in a volume
# and not have to start from scratch on every build.

# runs on port 3000
CMD ["npm", "run", "dev"]
