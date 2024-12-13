import { createClientLogger } from "@emss/logger";

/**
 * **Do not use on server.**
 *
 * Used for client-side logging only.
 */
const clientLogger = createClientLogger("/api/v1/log/from-client");

export default clientLogger;
