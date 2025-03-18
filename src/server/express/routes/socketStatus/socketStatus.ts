import { asError } from "@emss/utils";
import express, { Request, Response } from "express";
import { getUser } from "packages/getUser";
import { globalValues } from "server/express/global";
import serverLogger from "utils/serverLogger";
import { isSuperuser } from "utils/user";

/**
 * `/api/v1/socketStatus`
 *
 * Get server socket status
 */

const router = express.Router();

// get
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getUser(req);
    if (user instanceof Error) {
      const msg = "Unable to decode JWT";
      serverLogger.error(user, { logId: msg });
      res.status(500).send({ msg });
      return;
    }

    if (!isSuperuser(user)) {
      serverLogger.warn({ logId: "Unauthorized access to socketStatus route" }, user);
      res.status(403).send({ msg: "Unauthorized" });
      return;
    }

    res.status(200).json(globalValues.serverSocketStatus);
    return;
  } catch (e) {
    serverLogger.error(asError(e), { logId: "error in socketStatus route" });
    res.status(400).json({ error: e.toString() });
    return;
  }
});

export default router;
