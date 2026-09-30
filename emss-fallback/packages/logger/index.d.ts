import type { Request, Response } from "express";
import type { EmssUser } from "@emss/oauth2-proxy-common";
import type { Loggable, LogLevel } from "./types";

type ServerLogger = {
  emergency: (loggable: Loggable, user?: EmssUser) => Promise<unknown>;
  alert: (loggable: Loggable, user?: EmssUser) => Promise<unknown>;
  critical: (error: Error, loggable: Loggable, user?: EmssUser) => Promise<unknown>;
  error: (error: Error, loggable: Loggable, user?: EmssUser) => Promise<unknown>;
  warning: (loggable: Loggable, user?: EmssUser) => Promise<unknown>;
  notice: (loggable: Loggable, user?: EmssUser) => Promise<unknown>;
  info: (loggable: Loggable, user?: EmssUser) => Promise<unknown>;
  debug: (loggable: Loggable, user?: EmssUser) => Promise<unknown>;
  forwardFromClient: (loggable: Loggable & { logLevel: LogLevel }, user: EmssUser) => Promise<unknown>;
  logUserLogin: (user: EmssUser) => Promise<unknown>;
};

export declare const createServerLogger: (props: {
  logEnableAppLogging: boolean;
  logServerHttpEndpoint: string;
  logDataAppId: string;
  logDataServerName: string;
}) => ServerLogger;

export declare const sendClientLogsToLogstash: (args: {
  req: Request;
  res: Response;
  user: EmssUser;
  serverLogger: ServerLogger;
}) => unknown;