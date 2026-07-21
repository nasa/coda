import { DotenvConfig } from "@emss/make-dotenv/types";

export const environments = ["local", "fit", "test", "prod"] as const;

export const config: DotenvConfig<typeof environments> = {
  /**
   * Unified auth
   * Hostname of the shared oauth2-proxy this app delegates `auth_request` to.
   * The proxy lives at `https://${AUTH_HOST}/unified-auth/...` and owns the
   * OIDC dance with LaunchPad. Today only one shared proxy exists
   * (emss-labs.fit.nasa.gov, backed by LaunchPad SBX), so every environment
   * points at it. When/if a prod-LaunchPad-backed shared proxy is stood up
   * (e.g. emss-prod.fit.nasa.gov), flip `prod` to that hostname here. The
   * value is consumed at container start by `docker/nginx/docker-entrypoint.sh`,
   * which envsubst's it into `setup-auth-unified.conf`.
   */
  AUTH_HOST: {
    // prod: "emss-prod.fit.nasa.gov", // <- when a prod-LaunchPad shared proxy exists
    default: "emss-labs.fit.nasa.gov",
  },

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
  // Note: VITE vars are embedded at build time so no env-specific values like "prod" are allowed.
  // TODO(before merge to int): point back at prod talkybot. Currently aimed at the
  // carbon-emss-dev server to test against the dev talkybot shared-auth deployment.
  // VITE_PUBLIC_TALKYBOT_URL: { default: "https://talkybot.fit.nasa.gov" },
  VITE_PUBLIC_TALKYBOT_URL: { default: "https://carbon-emss-dev.fit.nasa.gov" },

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
  // Note: VITE vars are embedded at build time so no env-specific values like "prod" are allowed.
  VITE_PUBLIC_LIVE_STREAMS_ENABLED: { default: "true" },
  /* REMEMBER THIS IS IN the DOCKERFILE DIRECTLY AND CI YML TOO */
  // Note: VITE vars are embedded at build time so no env-specific values like "prod" are allowed.
  VITE_PUBLIC_MEDIA_MTX_CONTROL_URL: {
    local: "http://127.0.0.1:9997/",
    default: "https://emss-lambda2.fit.nasa.gov/api/",
  },
  /* REMEMBER THIS IS IN the DOCKERFILE DIRECTLY AND CI YML TOO */
  // Note: VITE vars are embedded at build time so no env-specific values like "prod" are allowed.
  VITE_PUBLIC_MEDIA_MTX_HLS_URL: {
    local: "http://127.0.0.1:8888/",
    default: "https://emss-lambda2.fit.nasa.gov/live/",
  },
  /* REMEMBER THIS IS IN the DOCKERFILE DIRECTLY AND CI YML TOO */
  // Note: VITE vars are embedded at build time so no env-specific values like "prod" are allowed.
  VITE_PUBLIC_MEDIA_MTX_RECORDINGS_URL: {
    local: "http://127.0.0.1:9996/",
    default: "https://emss-lambda2.fit.nasa.gov/recordings/",
  },
  /* REMEMBER THIS IS IN the DOCKERFILE DIRECTLY AND CI YML TOO */
  // Note: VITE vars are embedded at build time so no env-specific values like "prod" are allowed.
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
  // Note: VITE vars are embedded at build time so no env-specific values like "prod" are allowed.
  // no trailing slash
  VITE_PUBLIC_MAPLIBRE_BASE_URL: { default: "https://emss-labs.fit.nasa.gov/localearth" },
  /* REMEMBER THIS IS IN the DOCKERFILE DIRECTLY AND CI YML TOO */
  // Note: VITE vars are embedded at build time so no env-specific values like "prod" are allowed.
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
  // Note: VITE vars are embedded at build time so no env-specific values like "prod" are allowed.
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
  // Note: VITE vars are embedded at build time so no env-specific values like "prod" are allowed.
  VITE_PUBLIC_LOG_LEVEL: {
    local: "debug",
    default: "info",
  },

  /**
   * Ephemeris sync
   * Blank will sync from Space-Track, otherwise remote sync from a URL
   * Prod should leave it blank so it fetches from Space-Track.
   * All other environments should sync from prod
   */
  EPHEMERIS_SYNC_FROM_URL: {
    prod: "",
    default: "https://coda.fit.nasa.gov",
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
