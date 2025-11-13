import { asError } from "@emss/utils";
import express, { Request, Response } from "express";
import { getUser } from "packages/getUser";
import serverLogger from "utils/serverLogger";
import { isSuperuser } from "utils/user";
import { forceRefreshDataType } from "server/express/dataRetrievalScheduler";

/**
 * `/api/v1/emss/dataRefresh`
 *
 * Force refresh a specific data type for a source and date
 */

const router = express.Router();

interface DataRefreshRequestBody {
  source: Source;
  dateWanted: string;
  dataType: StoreDataType;
}

// POST - force refresh
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getUser(req);
    if (user instanceof Error) {
      const msg = "Unable to decode JWT";
      serverLogger.error(user, { logId: msg });
      res.status(500).send({ msg });
      return;
    }

    if (!isSuperuser(user)) {
      serverLogger.warn({ logId: "Unauthorized access to dataRefresh route" }, user);
      res.status(403).send({ msg: "Unauthorized" });
      return;
    }

    const { source, dateWanted, dataType } = req.body as DataRefreshRequestBody;

    if (!source || !dateWanted || !dataType) {
      res.status(400).send({ msg: "Missing required parameters: source, dateWanted, dataType" });
      return;
    }

    serverLogger.info({ logId: "Force refresh initiated", source, dateWanted, dataType }, user);

    // Call the force refresh function
    const result = await forceRefreshDataType({ source, dateWanted, dataType });

    if (result.success) {
      res.status(200).json({
        msg: "Force refresh initiated successfully",
        data: result.data,
      });
    } else {
      res.status(500).json({
        msg: "Force refresh failed",
        error: result.error,
      });
    }
    return;
  } catch (e) {
    serverLogger.error(asError(e), { logId: "error in dataRefresh route" });
    res.status(400).json({ error: e.toString() });
    return;
  }
});

export default router;
