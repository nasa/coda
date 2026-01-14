import { asError } from "@emss/utils";
import express, { Request, Response } from "express";
import { requireSuperuser } from "server/express/middleware/requireSuperuser";
import serverLogger from "utils/logging/serverLogger";
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
router.post("/", requireSuperuser, async (req: Request, res: Response): Promise<void> => {
  try {
    const { source, dateWanted, dataType } = req.body as DataRefreshRequestBody;

    if (!source || !dateWanted || !dataType) {
      res.status(400).send({ msg: "Missing required parameters: source, dateWanted, dataType" });
      return;
    }

    serverLogger.info({ logId: "Force refresh initiated", source, dateWanted, dataType });

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
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    return;
  }
});

export default router;
