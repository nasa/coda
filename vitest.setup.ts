/**
 * Vitest setup file
 */
import ConsoleLogger from "./src/utils/logging/consoleLogger";

// Suppress ConsoleLogger output during tests
ConsoleLogger.setLevel("off");
