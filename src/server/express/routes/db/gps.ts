import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";
import { getEM } from "utils/mikro";
import { GPXTracks_db } from "server/database/models/_allModels";
import { getGpxTrackRecordsByDate, getGpxTrackRecordsList } from "server/processing/db/gps";

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
      const wrappedResponse: WrappedResponse<GPXTrackRecord[]> = {
        responseMetadata: {
          retrieverStatus: "complete",
          cachedTimestamp: null,
          expiration: null,
          error: null,
          retrieverErrorCount: 0,
          lastErrorTimestamp: null,
        },
        source: "database",
        data: records,
      };
      res.status(200).json(wrappedResponse);
    } else {
      const records: GPXTrackListRecord[] = await getGpxTrackRecordsList();
      const wrappedResponse: WrappedResponse<GPXTrackListRecord[]> = {
        responseMetadata: {
          retrieverStatus: "complete",
          cachedTimestamp: null,
          expiration: null,
          error: null,
          retrieverErrorCount: 0,
          lastErrorTimestamp: null,
        },
        source: "database",
        data: records,
      };
      res.status(200).json(wrappedResponse);
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: "error", message: `Error processing the GET request ${e}` });
  }
});

// get by id
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;

  try {
    const em = getEM();
    const gpxTrackRecord: GPXTrackRecord = await em.findOne(GPXTracks_db, { id: Number(id) });
    if (gpxTrackRecord) {
      const wrappedResponse: WrappedResponse<GPXTrackRecord> = {
        responseMetadata: {
          retrieverStatus: "complete",
          cachedTimestamp: null,
          expiration: null,
          error: null,
          retrieverErrorCount: 0,
          lastErrorTimestamp: null,
        },
        source: "database",
        data: gpxTrackRecord,
      };
      res.status(200).json(wrappedResponse);
    } else {
      const wrappedResponse: WrappedResponse<GPXTrackRecord> = {
        responseMetadata: {
          retrieverStatus: "error",
          cachedTimestamp: null,
          expiration: null,
          error: "gpx track not found",
          retrieverErrorCount: 0,
          lastErrorTimestamp: null,
        },
        source: "database",
        data: null,
      };
      res.status(404).json(wrappedResponse);
    }
  } catch (e) {
    console.error(e);
    const wrappedResponse: WrappedResponse<GPXTrackRecord> = {
      responseMetadata: {
        retrieverStatus: "error",
        cachedTimestamp: null,
        expiration: null,
        error: e.toString(),
        retrieverErrorCount: 1,
        lastErrorTimestamp: null,
      },
      source: "database",
      data: null,
    };
    res.status(500).json(wrappedResponse);
  }
});

// create via post
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { id, date, name, gpxData } = req.body as GPSUpsertRequest;

  try {
    const em = getEM();
    if (id) {
      const gpxTrackRecord = await em.findOne(GPXTracks_db, { id: Number(id) });
      if (gpxTrackRecord) {
        gpxTrackRecord.date = date;
        gpxTrackRecord.name = name;
        gpxTrackRecord.gpxData = gpxData;
        await em.persistAndFlush(gpxTrackRecord);
        res
          .status(200)
          .json({ status: "success", message: "gpx track updated", data: gpxTrackRecord });
      } else {
        res.status(404).json({ status: "error", message: "gpx track not found" });
      }
    } else {
      const gpxTrackRecord: GPXTrackRecord = em.create(GPXTracks_db, { date, name, gpxData });
      await em.persistAndFlush(gpxTrackRecord);
      res
        .status(201)
        .json({ status: "success", message: "gpx track inserted", data: gpxTrackRecord });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: "error", message: `Error processing the POST request ${e}` });
  }
});

// delete
router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;

  try {
    const em = getEM();
    const gpxTrackRecord: GPXTrackRecord = await em.findOne(GPXTracks_db, { id: Number(id) });
    if (gpxTrackRecord) {
      await em.removeAndFlush(gpxTrackRecord);
      res.status(200).json({ status: "success", message: "gpx track deleted" });
    } else {
      res.status(404).json({ status: "error", message: "gpx track not found" });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: "error", message: `Error processing the DELETE request ${e}` });
  }
});

export default router;
