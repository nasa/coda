export type LogLevel = "off" | "error" | "warn" | "notice" | "info" | "debug";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  off: 0,
  error: 1,
  warn: 2,
  notice: 3,
  info: 4,
  debug: 5,
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

export class ConsoleLogger {
  private static level: LogLevel = "off";
  private static initialized = false;

  /**
   * Initialize the console logger level based on the environment.
   * This is called automatically on first use.
   */
  private static initialize() {
    if (this.initialized) return;
    this.initialized = true;

    // Detect environment and set log level accordingly
    if (isServer) {
      // Server side: use process.env
      const logLevel = (process.env.VITE_PUBLIC_LOG_LEVEL as LogLevel) || "off";
      this.level = logLevel;
    } else {
      // Client side: use import.meta.env
      const logLevel = (import.meta.env.VITE_PUBLIC_LOG_LEVEL as LogLevel) || "off";
      this.level = logLevel;
    }
  }

  private static getTimestamp(): string {
    const iso = new Date().toISOString(); // "2026-01-08T19:30:45.123Z"
    return `[${iso.slice(5, 10)} ${iso.slice(11, 23)}]`; // "[01-08 19:30:45.123]"
  }

  /**
   * Check if a message at the given level should be logged.
   * A message is logged if the configured level is verbose enough to include it.
   * Level hierarchy: off < error < warn < log < debug
   * Example: if level is "warn", then error and warn messages are shown, but log and debug are not.
   */
  private static shouldLog(messageLevel: LogLevel): boolean {
    this.initialize();
    return LOG_LEVEL_PRIORITY[messageLevel] <= LOG_LEVEL_PRIORITY[this.level];
  }

  static setLevel(level: LogLevel): void {
    this.level = level;
    this.initialized = true; // Prevent initialize() from overriding the manually set level
  }

  static getLevel(): LogLevel {
    return this.level;
  }

  static error(...args: unknown[]): void {
    if (this.shouldLog("error")) {
      console.error(`${LEVEL_COLORS.error}${this.getTimestamp()} [ERROR]${COLORS.reset}`, ...args);
    }
  }

  static warn(...args: unknown[]): void {
    if (this.shouldLog("warn")) {
      console.warn(`${LEVEL_COLORS.warn}${this.getTimestamp()} [WARN]${COLORS.reset}`, ...args);
    }
  }

  static notice(...args: unknown[]): void {
    if (this.shouldLog("notice")) {
      console.log(`${LEVEL_COLORS.notice}${this.getTimestamp()} [NOTICE]${COLORS.reset}`, ...args);
    }
  }

  static info(...args: unknown[]): void {
    if (this.shouldLog("info")) {
      console.log(`${LEVEL_COLORS.info}${this.getTimestamp()} [INFO]${COLORS.reset}`, ...args);
    }
  }

  static debug(...args: unknown[]): void {
    if (this.shouldLog("debug")) {
      console.debug(`${LEVEL_COLORS.debug}${this.getTimestamp()} [DEBUG]${COLORS.reset}`, ...args);
    }
  }
}

// Export default instance
export default ConsoleLogger;
