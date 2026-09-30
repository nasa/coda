import type { Request, Response } from "express";
import type { EmssUser } from "@emss/oauth2-proxy-common";

export declare const getUserFromJWT: (request: Request) => EmssUser | Error;
export declare const handleUnableToDecodeJWT: (error: Error, response: Response) => void;