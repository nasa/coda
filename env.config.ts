import { DotenvConfig } from "@emss/make-dotenv/src/types";

export const environments = ["local", "fit", "test", "prod"] as const;

export const config: DotenvConfig<typeof environments> = {
  /**
   * Launchpad
   * Only our prod URLs are added to launchpad prod. All environments (dev/int/prod) are added to launchpad sandbox.
   * Ultimately we want to use sandbox launchpad for everything except prod (including local dev)
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
    prod: "https://authfs.launchpad.nasa.gov/adfs",
    default: "https://authfs.launchpad-sbx.nasa.gov/adfs",
  },
  OAUTH2_PROXY_LOGIN_URL: {
    prod: "https://authfs.launchpad.nasa.gov/adfs/oauth2/authorize/",
    default: "https://authfs.launchpad-sbx.nasa.gov/adfs/oauth2/authorize/",
  },
  OAUTH2_PROXY_REDEEM_URL: {
    prod: "https://authfs.launchpad.nasa.gov/adfs/oauth2/token/",
    default: "https://authfs.launchpad-sbx.nasa.gov/adfs/oauth2/token/",
  },
  OAUTH2_PROXY_OIDC_JWKS_URL: {
    prod: "https://authfs.launchpad.nasa.gov/adfs/discovery/keys",
    default: "https://authfs.launchpad-sbx.nasa.gov/adfs/discovery/keys",
  },
  OAUTH2_PROXY_WHITELIST_DOMAIN: {
    prod: "authfs.launchpad.nasa.gov",
    default: "authfs.launchpad-sbx.nasa.gov",
  },
  OAUTH2_PROXY_CLIENT_ID: {
    prod: { type: "alternate-varname-from-secret-file", value: "LAUNCHPAD_PRODUCTION_CLIENT_ID" },
    default: { type: "alternate-varname-from-secret-file", value: "LAUNCHPAD_SANDBOX_CLIENT_ID" },
  },
  OAUTH2_PROXY_CLIENT_SECRET: {
    prod: {
      type: "alternate-varname-from-secret-file",
      value: "LAUNCHPAD_PRODUCTION_CLIENT_SECRET",
    },
    default: {
      type: "alternate-varname-from-secret-file",
      value: "LAUNCHPAD_SANDBOX_CLIENT_SECRET",
    },
  },

  // Ultimately need to alter this based on what server we're on (prod/int/dev). Currently this override
  // happens in the pipeline deploy script. `INSERT_SUBDOMAIN` that gets replaced
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
  //# Unlikely these ever need to change
  VITE_PUBLIC_TALKYBOT_URL: { default: "https://talkybot.fit.nasa.gov" },
  // VITE_PUBLIC_TALKYBOT_URL: { default: "https://neon-emss-dev.fit.nasa.gov" },

  // Although this would seem to change between envs, it is only the origin
  // header passed along with IO requests, and it is simpler to just always
  // use coda.fit.nasa.gov to remove variance. We should rename this var to
  // something like "IO_REQUEST_ORIGIN_HEADER" or something.
  HOST: { default: "https://coda.fit.nasa.gov" },

  /**
   * Container image info
   */
  // Image version is used to make each image name unique to each commit's pipeline
  IMAGE_VERSION: { default: process.env.IMAGE_VERSION || "dev" },
  REGISTRY_IMAGE: {
    default: "eegitlabregistry.fit.nasa.gov/emss/coda",
  },

  /**
   * Database
   */
  DOCKER_DB_DATA_DIR: { local: "./.local/database", default: "/d1/coda/postgres" },
  DOCKER_DB_INIT_DIR: { local: "./.local/db-init", default: "/d1/coda/db-init" },
  DOCKER_IMAGE_DATABASE: { default: "postgres:17.7-alpine3.22" },

  // DB_HOST is "localhost" when doing native/local Node development. When running
  // node in docker in docker:preview, this will be overridden in the
  // docker-compose-preview.yml to be "database"
  DB_HOST: { local: "localhost", default: "database" },
  DB_NAME: { default: "coda" },

  // Use a different port for local development to avoid conflicts with other apps
  // when doing dev in docker:services mode
  DB_PORT: { local: "5431", default: "5432" },

  /**
   * MTX Live streams
   */
  /* REMEMBER THIS IS IN the DOCKERFILE DIRECTLY AND CI YML TOO */
  VITE_PUBLIC_LIVE_STREAMS_ENABLED: { default: "true" },
  /* REMEMBER THIS IS IN the DOCKERFILE DIRECTLY AND CI YML TOO */
  VITE_PUBLIC_MEDIA_MTX_CONTROL_URL: {
    local: "http://127.0.0.1:9997/",
    default: "https://emss-lambda2.fit.nasa.gov/api/",
  },
  /* REMEMBER THIS IS IN the DOCKERFILE DIRECTLY AND CI YML TOO */
  VITE_PUBLIC_MEDIA_MTX_HLS_URL: {
    local: "http://127.0.0.1:8888/",
    default: "https://emss-lambda2.fit.nasa.gov/live/",
  },
  /* REMEMBER THIS IS IN the DOCKERFILE DIRECTLY AND CI YML TOO */
  VITE_PUBLIC_MEDIA_MTX_RECORDINGS_URL: {
    local: "http://127.0.0.1:9996/",
    default: "https://emss-lambda2.fit.nasa.gov/recordings/",
  },
  /* REMEMBER THIS IS IN the DOCKERFILE DIRECTLY AND CI YML TOO */
  VITE_PUBLIC_MTX_VIDEO_MAX_AGE_DAYS: {
    default: "7",
  },
  /**
   * HLS buffer duration in seconds. This should match MediaMTX's hlsSegmentCount * hlsSegmentDuration.
   * Default: 900 seconds (15 minutes) = 180 segments * 5 seconds
   */
  HLS_BUFFER_DURATION_SECONDS: {
    default: "900",
  },

  /**
   * Maplibre variables
   */
  /* REMEMBER THIS IS IN the DOCKERFILE DIRECTLY AND CI YML TOO */
  // no trailing slash
  VITE_PUBLIC_MAPLIBRE_BASE_URL: { default: "https://emss-labs.fit.nasa.gov/localearth" },
  /* REMEMBER THIS IS IN the DOCKERFILE DIRECTLY AND CI YML TOO */
  VITE_PUBLIC_MAPLIBRE_PMTILES_FILENAME: { default: "20250213.pmtiles" },

  /*
  !!!! SENSITIVE DATA !!!!

  The following env vars are sensitive! Do not send them to anyone who doesn't need them
  If sending them to someone who does need them, send via encrypted email.

  If you need values, request from CODA developers or copy from GitLab CI/CD variables. These values
  will be stored in .env.secret so make-dotenv.sh can reuse them.
  */

  MEDIAMTX_USERNAME: {
    default: {
      type: "required-from-secret",
    },
  },
  MEDIAMTX_PASSWORD: {
    default: {
      type: "required-from-secret",
    },
  },

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
  SPACETRACK_USERNAME: {
    default: {
      type: "required-from-secret",
    },
  },
  SPACETRACK_PASSWORD: {
    default: {
      type: "required-from-secret",
    },
  },
  // Generate passwords if there weren't any sourced from the env.secret.ts
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
  //
  // Also used by the @emss/logger package
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
    local: "https://emss-logging.fit.nasa.gov/applog",

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

  // Mock up the user when running in non-docker local dev or else JWT errors will occur
  MOCK_USER: {
    local: "true",
    default: "false",
  },

  // log level for ConsoleLogger and emss logging service (off, error, warn, info, debug)
  VITE_PUBLIC_LOG_LEVEL: {
    local: "debug",
    default: "info",
  },

  /**
   * EMSS Token for inter-service communication
   */
  EMSS_TOKEN: {
    default: {
      type: "required-from-secret",
    },
  },
};
