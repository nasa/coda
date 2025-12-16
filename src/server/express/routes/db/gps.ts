import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";
import {
  getGpxTrackRecordById,
  getGpxTrackRecordsByDate,
  getGpxTrackRecordsList,
  upsertGpxTrackRecord,
  deleteGpxTrackRecordById,
} from "server/processing/gps";
import { requireSuperuser } from "server/express/middleware/requireSuperuser";
import ConsoleLogger from "utils/logging/consoleLogger";

/**
 * Get gps tracks from CODA DB for a given date
 */

const router = express.Router();

const parseQuery = (query: Query): GPSTracksQueryParams => {
  const { dateWanted } = query;
  const queryObj: GPSTracksQueryParams = {
    dateWanted: dateWanted as string,
  };
  return queryObj;
};

// get by date or get list if no date provided
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const queryObj = parseQuery(req.query);

  try {
    if (queryObj.dateWanted) {
      if (
        !queryObj.dateWanted.match(
          /^(19|20)\d\d[- /.](0[1-9]|1[012])[- /.](0[1-9]|[12][0-9]|3[01])$/
        )
      ) {
        res.status(400).json({ status: "error", message: "Invalid date format" });
        return;
      }
      const records: GPXTrackRecord[] = await getGpxTrackRecordsByDate(queryObj.dateWanted);
      res.status(200).json(records);
    } else {
      const records: GPXTrackListRecord[] = await getGpxTrackRecordsList();
      res.status(200).json(records);
    }
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the GET request ${e}` });
  }
});

// get by id
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;

  try {
    const gpxTrackRecord = await getGpxTrackRecordById(Number(id));
    if (gpxTrackRecord) {
      res.status(200).json(gpxTrackRecord);
    } else {
      res.status(404).json({ status: "error", message: "gpx track not found" });
    }
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the GET request ${e}` });
  }
});

// create via post
router.post("/", requireSuperuser, async (req: Request, res: Response): Promise<void> => {
  const { id, date, name, gpxData } = req.body as GPSUpsertRequest;

  try {
    const result = await upsertGpxTrackRecord({ id, date, name, gpxData });
    if (!result) {
      res.status(404).json({ status: "error", message: "gpx track not found" });
      return;
    }

    const { record, isNew } = result;
    const statusCode = isNew ? 201 : 200;
    const message = isNew ? "gpx track inserted" : "gpx track updated";
    res.status(statusCode).json({ status: "success", message, data: record });
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the POST request ${e}` });
  }
});

// delete
router.delete("/:id", requireSuperuser, async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;

  try {
    const deleted = await deleteGpxTrackRecordById(Number(id));
    if (deleted) {
      res.status(200).json({ status: "success", message: "gpx track deleted" });
    } else {
      res.status(404).json({ status: "error", message: "gpx track not found" });
    }
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the DELETE request ${e}` });
  }
});

export default router;
