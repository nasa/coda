import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";
import { globalValues } from "server/express/global";
import { Loaded } from "@mikro-orm/postgresql";
import { MediaOverride_db } from "server/database/models/_allModels";
import { requireSuperuser } from "server/express/middleware/requireSuperuser";
import ConsoleLogger from "utils/logging/consoleLogger";

/**
 * Get Media Override URLs from CODA DB for a given date
 */

const router = express.Router();

const parseQuery = (query: Query): MediaOverrideQueryParams => {
  const { dateWanted } = query;
  const queryObj: MediaOverrideQueryParams = {
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
      const records: MediaOverride[] = await getMediaOverridesByDate(queryObj.dateWanted);
      res.status(200).json(records);
    } else {
      const records: MediaOverrideList[] = await getMediaOverridesList();
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
  const em = globalValues.orm.em;

  try {
    const mediaOverride: MediaOverride = await em.findOne(MediaOverride_db, { id: Number(id) });
    if (mediaOverride) {
      res.status(200).json(mediaOverride);
    } else {
      res.status(404).json({ status: "error", message: "media override not found" });
    }
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the GET request ${e}` });
  }
});

// create via post
router.post("/", requireSuperuser, async (req: Request, res: Response): Promise<void> => {
  const { id, date, source, type, url } = req.body as MediaOverrideUpsertRequest;
  const em = globalValues.orm.em;

  try {
    if (id) {
      const mediaOverride = await em.findOne(MediaOverride_db, { id: Number(id) });
      if (mediaOverride) {
        mediaOverride.date = date;
        mediaOverride.source = source;
        mediaOverride.type = type;
        mediaOverride.url = url;
        await em.persistAndFlush(mediaOverride);
        res
          .status(200)
          .json({ status: "success", message: "media override updated", data: mediaOverride });
      } else {
        res.status(404).json({ status: "error", message: "media override not found" });
      }
    } else {
      const mediaOverride: MediaOverride = em.create(MediaOverride_db, {
        id,
        date,
        source,
        type,
        url,
      });
      await em.persistAndFlush(mediaOverride);
      res
        .status(201)
        .json({ status: "success", message: "media override inserted", data: mediaOverride });
    }
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the POST request ${e}` });
  }
});

// delete
router.delete("/:id", requireSuperuser, async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const em = globalValues.orm.em;

  try {
    const mediaOverride: MediaOverride = await em.findOne(MediaOverride_db, { id: Number(id) });
    if (mediaOverride) {
      await em.removeAndFlush(mediaOverride);
      res.status(200).json({ status: "success", message: "media override deleted" });
    } else {
      res.status(404).json({ status: "error", message: "media override not found" });
    }
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the DELETE request ${e}` });
  }
});

export default router;

export async function getMediaOverridesByDate(date: string): Promise<MediaOverride[]> {
  const em = globalValues.orm.em;
  let mediaOverrides_db: Loaded<MediaOverride_db, never>[];
  mediaOverrides_db = await em.find(
    MediaOverride_db,
    { date: date },
    { orderBy: { source: "ASC" } }
  );
  if (mediaOverrides_db) {
    const mediaOverrideData: MediaOverride[] = mediaOverrides_db.map((mediaOverrideRecord) => {
      const mediaOverride = mediaOverrideRecord;
      return mediaOverride;
    });
    return mediaOverrideData;
  } else {
    return [];
  }
}

export async function getMediaOverridesList(): Promise<MediaOverrideList[]> {
  const em = globalValues.orm.em;
  const mediaOverrides_db = await em.find(
    MediaOverride_db,
    {},
    { orderBy: { date: "ASC", source: "ASC" }, fields: ["id", "date", "source", "type", "url"] }
  );
  if (mediaOverrides_db) {
    return mediaOverrides_db;
  } else {
    return [];
  }
}
