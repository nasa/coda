import type { Loggable } from "./types";

type ClientLogger = {
  emergency: (loggable: Loggable) => Promise<unknown>;
  alert: (loggable: Loggable) => Promise<unknown>;
  critical: (error: Error, loggable: Loggable) => Promise<unknown>;
  debug: (loggable: Loggable) => Promise<unknown>;
  info: (loggable: Loggable) => Promise<unknown>;
  notice: (loggable: Loggable) => Promise<unknown>;
  warning: (loggable: Loggable) => Promise<unknown>;
  error: (error: Error, loggable: Loggable) => Promise<unknown>;
};

export declare const createClientLogger: (appLoggerEndpoint: string) => ClientLogger;