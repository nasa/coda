import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";
import { getORM } from "server/express/global";
import { MediaOverride_db } from "server/database/models/mediaOverride.model";
import { AccessGrant_db } from "server/database/models/AccessGrant.model";
import { requireSuperuser } from "server/express/middleware/requireSuperuser";
import {
  getApplicableMediaOverrides,
  isCanonicalDate,
  validateMediaOverrideUrl,
} from "server/processing/mediaOverrideResolver";
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

const normalizeAccessGrantId = (raw: unknown): number | null | undefined => {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

const SOURCES: Source[] = ["ISS", "TEST_EVENTS", "NBL", "ARTEMIS"];
const MEDIA_TYPES: MediaMedium[] = ["video", "photo", "transcript", "audio"];
const MATCH_MODES: MediaOverrideMatchMode[] = ["exact", "daily"];

// get by date or get list if no date provided
router.get("/", requireSuperuser, async (req: Request, res: Response): Promise<void> => {
  const queryObj = parseQuery(req.query);

  try {
    if (queryObj.dateWanted) {
      if (!isCanonicalDate(queryObj.dateWanted)) {
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
router.get("/:id", requireSuperuser, async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const em = getORM().em;

  try {
    const mediaOverride = await em.findOne(MediaOverride_db, { id: Number(id) });
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
  const { id, date, source, type, url, accessGrantId } = req.body as MediaOverrideUpsertRequest;
  const matchMode = req.body.matchMode ?? "exact";
  const em = getORM().em;
  const normalizedGrantId = normalizeAccessGrantId(accessGrantId);

  if (id !== undefined && (!Number.isInteger(Number(id)) || Number(id) <= 0)) {
    res.status(400).json({ status: "error", message: "id must be a positive integer" });
    return;
  }
  if (!isCanonicalDate(date)) {
    res.status(400).json({ status: "error", message: "date must be a valid yyyy-mm-dd date" });
    return;
  }
  if (!SOURCES.includes(source)) {
    res.status(400).json({ status: "error", message: "Invalid source" });
    return;
  }
  if (!MEDIA_TYPES.includes(type)) {
    res.status(400).json({ status: "error", message: "Invalid media type" });
    return;
  }
  if (!MATCH_MODES.includes(matchMode)) {
    res.status(400).json({ status: "error", message: "Invalid match mode" });
    return;
  }
  const urlError = validateMediaOverrideUrl(url, matchMode);
  if (urlError) {
    res.status(400).json({ status: "error", message: urlError });
    return;
  }
  if (normalizedGrantId === undefined) {
    res
      .status(400)
      .json({ status: "error", message: "accessGrantId must be a positive integer or null" });
    return;
  }
  if (normalizedGrantId !== null && type !== "video") {
    res.status(400).json({
      status: "error",
      message: "Access grants are currently supported only for video overrides",
    });
    return;
  }

  try {
    if (normalizedGrantId !== null) {
      const grant = await em.findOne(AccessGrant_db, { id: normalizedGrantId });
      if (!grant) {
        res.status(400).json({ status: "error", message: "access grant not found" });
        return;
      }
    }
    if (id) {
      const mediaOverride = await em.findOne(MediaOverride_db, { id: Number(id) });
      if (mediaOverride) {
        mediaOverride.date = date;
        mediaOverride.source = source;
        mediaOverride.type = type;
        mediaOverride.matchMode = matchMode;
        mediaOverride.url = url.trim();
        mediaOverride.accessGrantId = normalizedGrantId;
        await em.persist(mediaOverride).flush();
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
        matchMode,
        url: url.trim(),
        accessGrantId: normalizedGrantId,
      });
      await em.persist(mediaOverride).flush();
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
  const em = getORM().em;

  try {
    const mediaOverride = await em.findOne(MediaOverride_db, { id: Number(id) });
    if (mediaOverride) {
      await em.remove(mediaOverride).flush();
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

async function getMediaOverridesByDate(date: string): Promise<MediaOverride[]> {
  const groups = await Promise.all(
    SOURCES.flatMap((source) =>
      MEDIA_TYPES.map((type) =>
        getApplicableMediaOverrides({
          source,
          type,
          requestedDate: date,
          visibility: "all",
        })
      )
    )
  );
  return groups.flat();
}

/**
 * Returns ALL media overrides including restricted ones. Used by the admin UI.
 * Do NOT use from public-data fetchers — use {@link getPublicMediaOverridesList} instead.
 */
export async function getMediaOverridesList(): Promise<MediaOverrideList[]> {
  const em = getORM().em.fork();
  const mediaOverrides_db = await em.find(
    MediaOverride_db,
    {},
    {
      orderBy: { date: "ASC", source: "ASC" },
      fields: ["id", "date", "source", "type", "matchMode", "url", "accessGrantId"],
    }
  );
  if (mediaOverrides_db) {
    return mediaOverrides_db;
  } else {
    return [];
  }
}

/**
 * Returns only PUBLIC media overrides (those with no accessGrantId). This is what
 * the socket-fed public video/photo fetchers should use, so restricted overrides
 * never leak into the public cache or the public Socket.IO room.
 */
export async function getPublicMediaOverridesList(): Promise<MediaOverrideList[]> {
  const em = getORM().em.fork();
  const mediaOverrides_db = await em.find(
    MediaOverride_db,
    { accessGrantId: null },
    {
      orderBy: { date: "ASC", source: "ASC" },
      fields: ["id", "date", "source", "type", "matchMode", "url", "accessGrantId"],
    }
  );
  return mediaOverrides_db ?? [];
}
