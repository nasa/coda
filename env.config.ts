import { DotenvConfig } from "@emss/make-dotenv/src/types";
import packageJSON from "./package.json";

export const environments = ["local", "fit", "test"] as const;

export const config: DotenvConfig<typeof environments> = {
  /**
   * Launchpad
   * Only our prod URLs are added to launchpad prod. All environments (dev/int/prod) are added to launchpad sandbox.
   * Ultimately we want to use sandbox launchpad for everything except prod (including local dev)
   * Currently we don't have a solution to make a prod version of a .env so right now use sandbox for everything
   */
  OAUTH2_PROXY_COOKIE_SECRET: {
    local: {
      type: "generate-to-secret-if-missing",
      length: 32,
      characters: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-=",
    },
    default: { type: "required-from-secret" },
  },
  OAUTH2_PROXY_OIDC_ISSUER_URL: {
    // prod: "https://authfs.launchpad.nasa.gov/adfs", confirm correct
    default: "https://authfs.launchpad-sbx.nasa.gov/adfs",
  },
  OAUTH2_PROXY_LOGIN_URL: {
    // prod: "https://authfs.launchpad.nasa.gov/adfs/oauth2/authorize/", confirm correct
    default: "https://authfs.launchpad-sbx.nasa.gov/adfs/oauth2/authorize/",
  },
  OAUTH2_PROXY_REDEEM_URL: {
    // prod: "https://authfs.launchpad.nasa.gov/adfs/oauth2/token/", confirm correct
    default: "https://authfs.launchpad-sbx.nasa.gov/adfs/oauth2/token/",
  },
  OAUTH2_PROXY_OIDC_JWKS_URL: {
    // prod: "https://authfs.launchpad.nasa.gov/adfs/discovery/keys", confirm correct
    default: "https://authfs.launchpad-sbx.nasa.gov/adfs/discovery/keys",
  },
  OAUTH2_PROXY_WHITELIST_DOMAIN: {
    // prod: "authfs.launchpad.nasa.gov", confirm correct
    default: "authfs.launchpad-sbx.nasa.gov",
  },
  OAUTH2_PROXY_CLIENT_ID: {
    // prod: { type: "alternate-varname-from-secret-file", value: "LAUNCHPAD_PRODUCTION_CLIENT_ID" },
    default: { type: "alternate-varname-from-secret-file", value: "LAUNCHPAD_SANDBOX_CLIENT_ID" },
  },
  OAUTH2_PROXY_CLIENT_SECRET: {
    // prod: {
    //   type: "alternate-varname-from-secret-file",
    //   value: "LAUNCHPAD_PRODUCTION_CLIENT_SECRET",
    // },
    default: {
      type: "alternate-varname-from-secret-file",
      value: "LAUNCHPAD_SANDBOX_CLIENT_SECRET",
    },
  },

  // Ultimately need to alter this based on what server we're on (prod/int/dev). Currently this override
  // happens in the pipeline depoy script. `INSERT_SUBDOMAIN` that gets replaced
  // with the appropriate subdomain during deploy.
  OAUTH2_PROXY_REDIRECT_URL: {
    // prod: "https://coda.fit.nasa.gov/api/v1/auth/nasalp/adfs/oidc/login",
    // int: "https://coda-int.fit.nasa.gov/api/v1/auth/nasalp/adfs/oidc/login",
    // dev: carbon, gold, iron, neon, oxygen...
    local: "https://coda-local.fit.nasa.gov/api/v1/auth/nasalp/adfs/oidc/login",
    default: "https://INSERT_SUBDOMAIN.fit.nasa.gov/api/v1/auth/nasalp/adfs/oidc/login",
  },
  REDIS_CACHE_DIR: { local: "./.local/redis", default: "/d1/coda/redis" },

  /**
   * Directories on the host
   * ENV vars for nginx
   */
  // Set all the other variables for the .env file
  DOCKER_HOST_SSL_CERTS_DIR: {
    local: { type: "make-directory-if-missing", value: "./.local/certs" },
    default: "/etc/pki/tls/certs",
  },
  DOCKER_HOST_SSL_PRIVATE_DIR: {
    local: { type: "make-directory-if-missing", value: "./.local/private" },
    default: "/etc/pki/tls/private",
  },
  DOCKER_HOST_HTTP_STATIC_DIR: {
    local: { type: "make-directory-if-missing", value: "./.local/static" },
    default: "/d1/coda/static",
  },

  /* 
  You probably don't want to change this away from "development"
  "development" for normal dev work, "local" to mock some services. Code seems to only look for
   whether this is set to "local" or not, so could be "local" or anything else.
  */
  VITE_PUBLIC_APP_ENV: { default: "development" },

  //# Unlikely these ever need to change
  IO_API_URL: { default: "https://io.jsc.nasa.gov/api/search/rpp=500" },
  IO_HOST: { default: "https://io.jsc.nasa.gov" },
  WIKI_BASE_URL: { default: "https://wiki.jsc.nasa.gov" },
  DEFAULT_CACHE_AGE: { default: 300 },
  TALKYBOT_URL: {
    local: "https://talkybot.fit.nasa.gov",
    default: "https://talkybot.fit.nasa.gov",
  },

  // Actual FIT environments deployed by GitLab CI the CACHE_ROOT needs to be relative
  // for tests run in GitLab CI
  // Varies based on fit, local, or running tests on GitLab
  CACHE_ROOT: { local: "./.cache/dev", test: "./.cache/test", default: "/d1/coda/cache" },

  // Although this would seem to change between envs, it is only the origin
  // header passed along with IO requests, and it is simpler to just always
  // use coda.fit.nasa.gov to remove variance. We should rename this var to
  // something like "IO_REQUEST_ORIGIN_HEADER" or something.
  HOST: { default: "https://coda.fit.nasa.gov" },

  // Optional for local dev only?
  IO_MOCK_MEDIA_URL: { default: "https://coda-data.apolloinrealtime.org/mocks/" },

  // - These values are not used locally since the docker-compose is overriden by
  //   the docker-compose.preview files. Those files build the images directly from the Dockerfiles
  // - IMAGE_VERSION is defined in the pipeline job
  // - The docker images to be used in docker compose when running in the pipeline. These
  //   values are not used locally.

  DOCKER_IMAGE_NGINX: {
    local: "NOT_USED_LOCALLY",
    default: `eegitlabregistry.fit.nasa.gov/emss/coda/nginx:${process.env.IMAGE_VERSION}`,
  },
  DOCKER_IMAGE_APIV1: {
    local: "NOT_USED_LOCALLY",
    default: `eegitlabregistry.fit.nasa.gov/emss/coda/apiv1:${process.env.IMAGE_VERSION}`,
  },
  DOCKER_DB_DATA_DIR: { local: "./.local/database", default: "/d1/coda/postgres" },
  DOCKER_DB_INIT_DIR: { local: "./.local/db-init", default: "/d1/coda/db-init" },

  /**
   * Database
   */
  // DB_HOST is "localhost" when doing native/local Node development. When running
  // node in docker in docker:preview, this will be overridden in the
  // docker-compose-preview.yml to be "database"
  DB_HOST: { local: "localhost", default: "database" },
  DB_NAME: { default: "coda" },

  // Use a different port for local development to avoid conflicts with other apps
  // when doing dev in docker:services mode
  DB_PORT: { local: "5431", default: "5432" },

  /*
  !!!! SENSITIVE DATA !!!!

  The following env vars are sensitive! Do not send them to anyone who doesn't need them
  If sending them to someone who does need them, send via encrypted email.

  If you need values, request from CODA developers or copy from GitLab CI/CD variables. These values
  will be stored in .env.secret so make-dotenv.sh can reuse them.
  */
  IO_KEY: {
    default: {
      type: "required-from-secret",
    },
  },
  WIKI_USER: {
    default: {
      type: "required-from-secret",
    },
  },
  WIKI_PASSWORD: {
    default: {
      type: "required-from-secret",
    },
  },
  SPACETRACK_USER: {
    default: {
      type: "required-from-secret",
    },
  },
  SPACETRACK_PASSWORD: {
    default: {
      type: "required-from-secret",
    },
  },
  VITE_PUBLIC_MAPBOX_KEY: {
    default: {
      type: "required-from-secret",
    },
  },
  TOPO_USER: {
    default: {
      type: "required-from-secret",
    },
  },
  TOPO_PASSWORD: {
    default: {
      type: "required-from-secret",
    },
  },
  // Generate passwords if there wern't any sourced from the env.secret.ts
  DB_PASS: {
    local: {
      type: "generate-to-secret-if-missing",
    },
    default: {
      type: "required-from-secret",
    },
  },
  /**
   * !!!! END SENSITIVE DATA !!!!
   */

  /**
   * Logging
   */
  // Used by @emss/logger package to determine if application logs should be
  // send to the logging server.
  LOG_ENABLE_APP_LOGGING: { local: "false", test: "false", default: "true" },

  // Unique ID for each app, for logging server search/filtering. This should
  // be as short as possible. It gets put in the syslog "tag" field alongside
  // other data, and the max length for tags is 32 characters, so keeping this
  // short lowers the risk of exceeding the tags max length.
  //
  // DO NOT include a double dash, e.g. --. This would break the filters in
  // Logstash.
  LOG_DATA_APP_ID: { default: "coda" },

  // Identifier for the server, e.g. `prod`, `carbon`, `local-dev`, etc.
  // Used by Rsyslog to mark container log messages, as well as by @emss/logger
  LOG_DATA_SERVER_NAME: {
    local: "local-dev",

    // gets altered at deploy-time depending on what server is being deployed
    default: "INSERT_LOG_DATA_SERVER_NAME",
  },

  // Used by @emss/logger package to determine destination for application logs
  // LOG_SERVER_HTTP_ENDPOINT is for _application logs_, e.g. when in the app
  // we do something like `clientLogger.info(...)`. It _IS_ possible to log
  // from local dev to logging servers in FIT, because application logs go
  // through the FIT proxy.
  LOG_SERVER_HTTP_ENDPOINT: {
    // When logging in local dev, you have some options:
    //
    // 1. Log to the prod log server:
    //    local: "https://emss-logging.fit.nasa.gov/applog",
    // 2. Log to a dev server with emss/logs deployed:
    //    local: "https://carbon-emss-dev.fit.nasa.gov/applog"
    // 3. Log to a locally-running log server running on port 9443:
    //    local: "https://localhost:9443/applog"
    //    (this may be problematic if we disallow insecure certs in emss/packages,
    //    "logger" package, as you'll need to setup a trusted cert)
    local: "https://carbon-emss-dev.fit.nasa.gov/applog",

    // Send this app's logs to a location in FIT. Typically this will be to the
    // emss-logging server, but could also be to dev servers running emss/logs
    // app. Examples:
    //
    // - "https://emss-logging.fit.nasa.gov/applog" (typical value, emss-logging server)
    // - "https://carbon-emss-dev.fit.nasa.gov/applog" (logging to carbon-emss-dev if emss/logs is running there)
    default: "https://emss-logging.fit.nasa.gov/applog",
  },

  // This is where each container's logging.options.syslog-address points to.
  // It will pretty much always be a location on the host, which will then
  // forward the logs on to a remote location.
  LOG_INTERNAL_ENDPOINT: {
    // In local dev on Windows, generally we want to keep the same value as FIT
    // because the UDP address won't care if the log messages fail to reach
    // their destination. If, however, we want to test against a logging server
    // running locally, the following can be uncommented, which will send logs
    // from the containers directly to the logstash-tcp-input of the logging
    // server, running on port 9602.
    // local: "tcp://host.docker.internal:9602",

    // For FIT, send to host machine's Rsyslog
    default: "udp://127.0.0.1:514",
  },

  /**
   * Versioning
   */
  APP_VERSION: {
    default: packageJSON.version,
  },
  GIT_COMMIT: {
    default: process.env.CI_COMMIT_SHA || "DEV",
  },
};
