import { sendClientLogsToLogstash } from "@emss/logger";
import { handleUnableToDecodeJWT } from "@emss/oauth2-proxy-backend";
import express, { Request, Response } from "express";
import { getUser } from "packages/getUser";
import serverLogger from "utils/serverLogger";

const router = express.Router();

/**
 * This is a standard endpoint that all EMSS apps should have. It is where
 * the clientLogger running in the browser sends info(), notice(), warn(),
 * and error() messages, so our server/API can add user/IP-address info to
 * the message, then forward the message on to our logging server.
 */
router.put("/", async (req: Request, res: Response): Promise<void> => {
  const user = getUser(req);
  if (user instanceof Error) {
    return handleUnableToDecodeJWT(user, res);
  }

  // this handles res.send(...); don't do any additional res.send(...) after this
  sendClientLogsToLogstash({ req, res, user, serverLogger });
});

export default router;
