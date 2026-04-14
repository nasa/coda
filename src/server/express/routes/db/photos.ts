import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";
import { Loaded } from "@mikro-orm/postgresql";
import { getORM } from "server/express/global";
import { PhotoTimeShifts_db } from "server/database/models/PhotoTimeShifts.model";
import { requireSuperuser } from "server/express/middleware/requireSuperuser";
import ConsoleLogger from "utils/logging/consoleLogger";

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
      const records: PhotoRecord[] = await getPhotoTimeshiftRecordsByDate(queryObj.dateWanted);
      res.status(200).json(records);
    } else {
      const records: PhotoRecord[] = await getPhotoTimeshiftRecordsList();
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
  const em = getORM().em;

  try {
    const photoRecord = await em.findOne(PhotoTimeShifts_db, { id: Number(id) });
    if (photoRecord) {
      res.status(200).json(photoRecord);
    } else {
      res.status(404).json({ status: "error", message: "photo record not found" });
    }
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the GET request ${e}` });
  }
});

// create via post
router.post("/", requireSuperuser, async (req: Request, res: Response): Promise<void> => {
  const { id, date, source, timeOffset } = req.body as PhotoUpsertRequest;
  const em = getORM().em;

  try {
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
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the POST request ${e}` });
  }
});

// delete
router.delete("/:id", requireSuperuser, async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const em = getORM().em;

  try {
    const photoRecord = await em.findOne(PhotoTimeShifts_db, {
      id: Number(id),
    });
    if (photoRecord) {
      await em.removeAndFlush(photoRecord);
      res.status(200).json({ status: "success", message: "photo time shift deleted" });
    } else {
      res.status(404).json({ status: "error", message: "photo time shift not found" });
    }
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the DELETE request ${e}` });
  }
});

export default router;

async function getPhotoTimeshiftRecordsByDate(date: string): Promise<PhotoRecord[]> {
  const em = getORM().em;
  const photoRecords_db: Loaded<PhotoRecord, never>[] = await em.find(
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

export async function getPhotoTimeshiftRecordsList(): Promise<PhotoRecord[]> {
  const em = getORM().em.fork();
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
