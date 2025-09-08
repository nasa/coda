import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";
import { getEM } from "utils/mikro";
import { Loaded } from "@mikro-orm/postgresql";
import { MediaOverride_db } from "server/database/models/_allModels";

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
      const wrappedResponse: WrappedResponse<MediaOverride[]> = {
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
      const records: MediaOverrideList[] = await getMediaOverridesList();
      const wrappedResponse: WrappedResponse<MediaOverrideList[]> = {
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
    const mediaOverride: MediaOverride = await em.findOne(MediaOverride_db, { id: Number(id) });
    if (mediaOverride) {
      const wrappedResponse: WrappedResponse<MediaOverride> = {
        responseMetadata: {
          retrieverStatus: "complete",
          cachedTimestamp: null,
          expiration: null,
          error: null,
          retrieverErrorCount: 0,
          lastErrorTimestamp: null,
        },
        source: "database",
        data: mediaOverride,
      };
      res.status(200).json(wrappedResponse);
    } else {
      const wrappedResponse: WrappedResponse<MediaOverride> = {
        responseMetadata: {
          retrieverStatus: "error",
          cachedTimestamp: null,
          expiration: null,
          error: "media override not found",
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
    const wrappedResponse: WrappedResponse<MediaOverride> = {
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
  const { id, date, source, type, url } = req.body as MediaOverrideUpsertRequest;

  try {
    const em = getEM();
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
    console.error(e);
    res.status(500).json({ status: "error", message: `Error processing the POST request ${e}` });
  }
});

// delete
router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;

  try {
    const em = getEM();
    const mediaOverride: MediaOverride = await em.findOne(MediaOverride_db, { id: Number(id) });
    if (mediaOverride) {
      await em.removeAndFlush(mediaOverride);
      res.status(200).json({ status: "success", message: "media override deleted" });
    } else {
      res.status(404).json({ status: "error", message: "media override not found" });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: "error", message: `Error processing the DELETE request ${e}` });
  }
});

export default router;

export async function getMediaOverridesByDate(date: string): Promise<MediaOverride[]> {
  const em = getEM();

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
  const em = getEM();

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
