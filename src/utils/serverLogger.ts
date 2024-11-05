import { createServerLogger } from "@emss/logger";

/**
 * **Do not use in browser.**
 *
 * Used for server-side logging only.
 */
const serverLogger = createServerLogger();

export default serverLogger;
