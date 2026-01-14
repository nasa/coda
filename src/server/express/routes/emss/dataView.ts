import { asError } from "@emss/utils";
import express, { Request, Response } from "express";
import { requireSuperuser } from "server/express/middleware/requireSuperuser";
import serverLogger from "utils/logging/serverLogger";
import { dataFetchConfigs, getSourceDateDataType } from "server/express/dataRetrievalScheduler";
import { isDataTypeValidForSourceAndDate } from "utils/sourceDataTypeMap";

const router = express.Router();

interface DataViewRequestQuery {
  source: Source;
  date: string;
  dataType: StoreDataType;
}

// GET - download data as JSON
router.get("/", requireSuperuser, async (req: Request, res: Response): Promise<void> => {
  try {
    const { source, date, dataType } = req.query as unknown as DataViewRequestQuery;

    if (!source || !date || !dataType) {
      res.status(400).send({ msg: "Missing required parameters: source, date, dataType" });
      return;
    }

    serverLogger.info({ logId: "Data view download initiated", source, date, dataType });

    // Find the config for the requested data type
    const dataFetchConfig = dataFetchConfigs.find((c) => c.type === dataType);

    if (!dataFetchConfig) {
      res.status(400).send({ msg: `Invalid data type: ${dataType}` });
      return;
    }

    // Check if the data type is valid for this source and date
    if (!isDataTypeValidForSourceAndDate(source, dataType, date)) {
      res
        .status(400)
        .send({ msg: `Data type ${dataType} is not available for source ${source} on ${date}` });
      return;
    }

    try {
      const response = await getSourceDateDataType({
        source,
        dateWanted: date,
        dataFetchConfig,
        autoRefresh: false, // Don't trigger auto-refresh when downloading
      });

      // Set headers for file download
      const filename = `${dataType}-${source}-${date}.json`;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      // Send formatted JSON for human readability
      res.status(200).send(JSON.stringify(response, null, 2));
      return;
    } catch (error) {
      serverLogger.error(asError(error), {
        logId: "Error fetching data type for download",
        dataType,
        source,
        date,
      });
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
      return;
    }
  } catch (e) {
    serverLogger.error(asError(e), { logId: "error in dataView route" });
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    return;
  }
});

export default router;
