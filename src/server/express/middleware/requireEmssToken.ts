import { Request, Response, NextFunction } from "express";
import ConsoleLogger from "utils/logging/consoleLogger";

/**
 * Express middleware for server-to-server (S2S) calls between CODA instances.
 * Requires `x-api-key: <EMSS_TOKEN>` header (consistent with Talkybot and
 * AEGIS/Maestro S2S patterns). Uses the same shared secret already used for
 * Talkybot S2S, so no new secret is needed in any environment.
 */
export const requireEmssToken = (req: Request, res: Response, next: NextFunction): void => {
  const expected = process.env.EMSS_TOKEN;
  if (!expected) {
    ConsoleLogger.error(
      `requireEmssToken: EMSS_TOKEN not configured on this instance; rejecting ${req.method} ${req.originalUrl}`
    );
    res.status(500).json({ status: "error", message: "Server misconfiguration" });
    return;
  }

  const provided =
    (req.headers["x-api-key"] as string | undefined)?.trim() ?? null;

  if (!provided || provided !== expected) {
    ConsoleLogger.warn(
      `requireEmssToken: rejected S2S request to ${req.method} ${req.originalUrl}`
    );
    res.status(401).json({ status: "error", message: "Unauthorized" });
    return;
  }

  next();
};
