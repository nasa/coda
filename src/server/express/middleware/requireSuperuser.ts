import { Request, Response, NextFunction } from "express";
import { getUser } from "packages/getUser";
import { isSuperuser } from "utils/user";
import ConsoleLogger from "utils/logging/consoleLogger";

/**
 * Express middleware that requires the user to have superuser privileges.
 * Returns 401 if user cannot be identified, 403 if user is not a superuser.
 * Should be used on all routes that modify data.
 */
export const requireSuperuser = (req: Request, res: Response, next: NextFunction): void => {
  const user = getUser(req);

  // Check if user can be identified
  if (user instanceof Error) {
    ConsoleLogger.warn(
      `requireSuperuser: Unauthenticated access attempt to ${req.method} ${req.originalUrl}`
    );
    res.status(401).json({ status: "error", message: "Unauthorized: Authentication required" });
    return;
  }

  // Check if user has superuser privileges
  if (!isSuperuser(user)) {
    ConsoleLogger.warn(
      `requireSuperuser: Unauthorized access attempt by ${user.display_name} to ${req.method} ${req.originalUrl}`
    );
    res.status(403).json({ status: "error", message: "Forbidden: Superuser access required" });
    return;
  }

  next();
};
