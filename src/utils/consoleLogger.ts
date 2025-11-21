export class ConsoleLogger {
  private static isEnabled: boolean = false;

  private static getTimestamp(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const seconds = now.getSeconds().toString().padStart(2, "0");
    const ms = now.getMilliseconds().toString().padStart(3, "0");
    return `[${hours}:${minutes}:${seconds}.${ms}]`;
  }

  static enable() {
    this.isEnabled = true;
  }

  static disable() {
    this.isEnabled = false;
  }

  static log(...args: any[]) {
    if (this.isEnabled) {
      console.log(this.getTimestamp(), ...args);
    }
  }

  static error(...args: any[]) {
    if (this.isEnabled) {
      console.error(this.getTimestamp(), ...args);
    }
  }

  static warn(...args: any[]) {
    if (this.isEnabled) {
      console.warn(this.getTimestamp(), ...args);
    }
  }
}

// Export default instance
export default ConsoleLogger;
