export class ConsoleLogger {
  private static isEnabled: boolean = false;

  static enable() {
    this.isEnabled = true;
  }

  static disable() {
    this.isEnabled = false;
  }

  static log(...args: any[]) {
    if (this.isEnabled) {
      console.log(...args);
    }
  }

  static error(...args: any[]) {
    if (this.isEnabled) {
      console.error(...args);
    }
  }

  static warn(...args: any[]) {
    if (this.isEnabled) {
      console.warn(...args);
    }
  }
}

// Export default instance
export default ConsoleLogger;
