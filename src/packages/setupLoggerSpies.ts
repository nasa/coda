/* eslint-env node, jest */

import expectCalledTimes from "@emss/jest-expect-called-times";
import clientLogger from "utils/clientLogger";
import serverLogger from "utils/serverLogger";

type ServerLoggerFunction = keyof typeof serverLogger;
type ClientLoggerFunction = keyof typeof clientLogger;

type ServerLoggerSpies = Record<ServerLoggerFunction, jest.SpyInstance<any, any[]>>;
type ClientLoggerSpies = Record<ClientLoggerFunction, jest.SpyInstance<any, any[]>>;

export type LoggerSpies = {
  server: ServerLoggerSpies;
  client: ClientLoggerSpies;
};

export const setupLoggerSpies = (): LoggerSpies => {
  const server: ServerLoggerSpies = {
    error: jest.spyOn(serverLogger, "error"),
    warn: jest.spyOn(serverLogger, "warn"),
    notice: jest.spyOn(serverLogger, "notice"),
    info: jest.spyOn(serverLogger, "info"),
    forwardFromClient: jest.spyOn(serverLogger, "forwardFromClient"),
    logUserLogin: jest.spyOn(serverLogger, "logUserLogin"),
  };

  const client: ClientLoggerSpies = {
    error: jest.spyOn(clientLogger, "error"),
    warn: jest.spyOn(clientLogger, "warn"),
    notice: jest.spyOn(clientLogger, "notice"),
    info: jest.spyOn(clientLogger, "info"),
  };

  return { server, client };
};

export const expectServerLoggerToBeCalledTimes = (
  spies: ServerLoggerSpies,
  spyCalls: Partial<Record<ServerLoggerFunction, number>> | "none"
): void => {
  if (spyCalls === "none") {
    spyCalls = {};
  }

  for (const [fnName, fn] of Object.entries(spies)) {
    if (fnName in spyCalls) {
      expectCalledTimes("serverLogger", fnName, fn, spyCalls[fnName as keyof ServerLoggerSpies]);
    } else {
      expectCalledTimes("serverLogger", fnName, fn, 0);
    }
  }
};

export const expectClientLoggerToBeCalledTimes = (
  spies: ClientLoggerSpies,
  spyCalls: Partial<Record<ClientLoggerFunction, number>> | "none"
): void => {
  if (spyCalls === "none") {
    spyCalls = {};
  }

  for (const [fnName, fn] of Object.entries(spies)) {
    if (fnName in spyCalls) {
      expectCalledTimes("clientLogger", fnName, fn, spyCalls[fnName as keyof ClientLoggerSpies]);
    } else {
      expectCalledTimes("clientLogger", fnName, fn, 0);
    }
  }
};

export const resetLoggerSpies = (spies: LoggerSpies): void => {
  for (const spy in spies.server) {
    spies.server[spy as keyof ServerLoggerSpies].mockRestore();
  }
  for (const spy in spies.client) {
    spies.client[spy as keyof ClientLoggerSpies].mockRestore();
  }
};
