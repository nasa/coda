import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";
import { Loaded } from "@mikro-orm/core";
import { getEM } from "utils/mikro";
import { PhotoTimeShifts_db } from "server/database/models/PhotoTimeShifts.model";

/**
 * Get photo datetime overrides from CODA DB for a given photo id
 */

const router = express.Router();

const parseQuery = (query: Query): PhotoQueryParams => {
  const { dateWanted } = query;
  const queryObj: PhotoQueryParams = {
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
      const records: PhotoRecord[] = await getPhotoRecordsByDate(queryObj.dateWanted);
      const wrappedResponse: WrappedResponse<PhotoRecord[]> = {
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
      const records: PhotoRecord[] = await getPhotoRecordsList();
      const wrappedResponse: WrappedResponse<PhotoRecord[]> = {
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
    const photoRecord: PhotoRecord = await em.findOne(PhotoTimeShifts_db, { id: Number(id) });
    if (photoRecord) {
      const wrappedResponse: WrappedResponse<PhotoRecord> = {
        responseMetadata: {
          retrieverStatus: "complete",
          cachedTimestamp: null,
          expiration: null,
          error: null,
          retrieverErrorCount: 0,
          lastErrorTimestamp: null,
        },
        source: "database",
        data: photoRecord,
      };
      res.status(200).json(wrappedResponse);
    } else {
      const wrappedResponse: WrappedResponse<PhotoRecord> = {
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
    const wrappedResponse: WrappedResponse<PhotoRecord> = {
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
  const { id, date, source, timeOffset } = req.body as PhotoUpsertRequest;

  try {
    const em = getEM();
    if (id) {
      const photoRecord = await em.findOne(PhotoTimeShifts_db, { id: Number(id) });
      if (photoRecord) {
        photoRecord.date = date;
        photoRecord.source = source;
        photoRecord.timeOffset = timeOffset;
        await em.persistAndFlush(photoRecord);
        res.status(200).json({
          status: "success",
          message: "photo date time override updated",
          data: photoRecord,
        });
      } else {
        res.status(404).json({ status: "error", message: "photo date time override not found" });
      }
    } else {
      const photoRecord: PhotoRecord = em.create(PhotoTimeShifts_db, { date, source, timeOffset });
      await em.persistAndFlush(photoRecord);
      res.status(201).json({
        status: "success",
        message: "photo date time override inserted",
        data: photoRecord,
      });
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
    const photoRecord: PhotoRecord = await em.findOne(PhotoTimeShifts_db, {
      id: Number(id),
    });
    if (photoRecord) {
      await em.removeAndFlush(photoRecord);
      res.status(200).json({ status: "success", message: "photo time shift deleted" });
    } else {
      res.status(404).json({ status: "error", message: "photo time shift not found" });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: "error", message: `Error processing the DELETE request ${e}` });
  }
});

export default router;

async function getPhotoRecordsByDate(date: string): Promise<PhotoRecord[]> {
  const em = getEM();

  let photoRecords_db: Loaded<PhotoRecord, never>[];
  photoRecords_db = await em.find(
    PhotoTimeShifts_db,
    { date: date },
    { orderBy: { source: "ASC" } }
  );
  if (photoRecords_db) {
    const photoRecordsData: PhotoRecord[] = photoRecords_db.map((photoRecord) => {
      const photoRecordData = photoRecord;
      return photoRecordData;
    });
    return photoRecordsData;
  } else {
    return [];
  }
}

export async function getPhotoRecordsList(): Promise<PhotoRecord[]> {
  const em = getEM();

  const photos_db = await em.find(
    PhotoTimeShifts_db,
    {},
    { orderBy: { date: "ASC", source: "ASC" }, fields: ["id", "date", "source", "timeOffset"] }
  );
  if (photos_db) {
    return photos_db;
  } else {
    return [];
  }
}
