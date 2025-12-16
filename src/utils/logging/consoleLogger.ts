export type LogLevel = "off" | "error" | "warn" | "notice" | "info" | "debug";
type EmssLogLevel = "error" | "warn" | "notice" | "info";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  off: 0,
  error: 1,
  warn: 2,
  notice: 3,
  info: 4,
  debug: 5,
};

// Map ConsoleLogger levels to @emss/logger levels (debug is not sent)
const EMSS_LEVEL_MAP: Record<Exclude<LogLevel, "off" | "debug">, EmssLogLevel> = {
  error: "error",
  warn: "warn",
  notice: "notice",
  info: "info",
};

// ANSI color codes for terminal output (works in Git Bash and most terminals)
const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
};

const LEVEL_COLORS: Record<Exclude<LogLevel, "off">, string> = {
  error: COLORS.red,
  warn: COLORS.yellow,
  notice: COLORS.blue,
  info: COLORS.green,
  debug: COLORS.gray,
};

/**
 * Detect if we're running on the server side (Node.js) or client side (browser).
 */
const isServer = typeof window === "undefined";

/**
 * Lazily load the appropriate logger based on the environment.
 * This avoids importing server-only code on the client and vice versa.
 */
let emssLogger: {
  info: (data: object) => void;
  notice: (data: object) => void;
  warn: (data: object) => void;
  error: (error: Error, data: object) => void;
} | null = null;

async function getEmssLogger() {
  if (emssLogger) return emssLogger;

  if (isServer) {
    // Dynamically import server logger to avoid bundling server code on client
    const { default: serverLogger } = await import("./serverLogger");
    emssLogger = serverLogger;
  } else {
    // Dynamically import client logger to avoid bundling client code on server
    const { default: clientLogger } = await import("./clientLogger");
    emssLogger = clientLogger;
  }

  return emssLogger;
}

/**
 * Format log arguments into a structured object for the @emss/logger.
 */
function formatArgsForEmssLogger(level: LogLevel, args: any[]) {
  const message = args
    .map((arg) => {
      if (arg instanceof Error) {
        return `${arg.name}: ${arg.message}`;
      }
      if (typeof arg === "object") {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(" ");

  return {
    logId: `console-${level}`,
    message,
    level,
  };
}

export class ConsoleLogger {
  private static level: LogLevel = "off";

  private static getTimestamp(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const seconds = now.getSeconds().toString().padStart(2, "0");
    const ms = now.getMilliseconds().toString().padStart(3, "0");
    return `[${hours}:${minutes}:${seconds}.${ms}]`;
  }

  /**
   * Check if a message at the given level should be logged.
   * A message is logged if the configured level is verbose enough to include it.
   * Level hierarchy: off < error < warn < log < debug
   * Example: if level is "warn", then error and warn messages are shown, but log and debug are not.
   */
  private static shouldLog(messageLevel: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[messageLevel] <= LOG_LEVEL_PRIORITY[this.level];
  }

  /**
   * Emit logs to the @emss/logger at the configured VITE_PUBLIC_LOG_LEVEL.
   * This sends logs to the appropriate endpoint (server or client).
   */
  private static emitToEmssLogger(level: LogLevel, args: any[]) {
    if (level === "off" || level === "debug" || !this.shouldLog(level)) return;

    const logData = formatArgsForEmssLogger(level, args);
    const emssLevel = EMSS_LEVEL_MAP[level as keyof typeof EMSS_LEVEL_MAP];

    getEmssLogger()
      .then((logger) => {
        if (emssLevel === "error") {
          // error() expects (Error, loggable) - create an Error from the message
          const err = args.find((a) => a instanceof Error) ?? new Error(logData.message);
          logger.error(err, logData);
        } else {
          logger[emssLevel](logData);
        }
      })
      .catch((err) => {
        // Silently fail if logger is not available to avoid infinite loops
        console.error("[ConsoleLogger] Failed to emit to @emss/logger:", err);
      });
  }

  static setLevel(level: LogLevel) {
    this.level = level;
  }

  static getLevel(): LogLevel {
    return this.level;
  }

  static error(...args: any[]) {
    if (this.shouldLog("error")) {
      console.error(`${LEVEL_COLORS.error}${this.getTimestamp()} [ERROR]${COLORS.reset}`, ...args);
      this.emitToEmssLogger("error", args);
    }
  }

  static warn(...args: any[]) {
    if (this.shouldLog("warn")) {
      console.warn(`${LEVEL_COLORS.warn}${this.getTimestamp()} [WARN]${COLORS.reset}`, ...args);
      this.emitToEmssLogger("warn", args);
    }
  }

  static notice(...args: any[]) {
    if (this.shouldLog("notice")) {
      console.log(`${LEVEL_COLORS.notice}${this.getTimestamp()} [NOTICE]${COLORS.reset}`, ...args);
      this.emitToEmssLogger("notice", args);
    }
  }

  static info(...args: any[]) {
    if (this.shouldLog("info")) {
      console.log(`${LEVEL_COLORS.info}${this.getTimestamp()} [INFO]${COLORS.reset}`, ...args);
      this.emitToEmssLogger("info", args);
    }
  }

  static debug(...args: any[]) {
    if (this.shouldLog("debug")) {
      console.debug(`${LEVEL_COLORS.debug}${this.getTimestamp()} [DEBUG]${COLORS.reset}`, ...args);
      this.emitToEmssLogger("debug", args);
    }
  }
}

// Export default instance
export default ConsoleLogger;
