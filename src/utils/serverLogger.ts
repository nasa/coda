import { createServerLogger } from "@emss/logger";
import { assertEnvVarsExist } from "@emss/utils";

const env = assertEnvVarsExist(
  "LOG_ENABLE_APP_LOGGING",
  "LOG_SERVER_HTTP_ENDPOINT",
  "LOG_DATA_APP_ID",
  "LOG_DATA_SERVER_NAME"
);

/**
 * **Do not use in browser.**
 *
 * Used for server-side logging only.
 */
const serverLogger = createServerLogger({
  logEnableAppLogging: env.LOG_ENABLE_APP_LOGGING === "true",
  logServerHttpEndpoint: env.LOG_SERVER_HTTP_ENDPOINT,
  logDataAppId: env.LOG_DATA_APP_ID,
  logDataServerName: env.LOG_DATA_SERVER_NAME,
});

export default serverLogger;
