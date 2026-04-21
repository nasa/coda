import express, { Request, Response } from "express";
import { getORM } from "server/express/global";
import { AssetOverride_db } from "server/database/models/AssetOverride.model";
import { requireSuperuser } from "server/express/middleware/requireSuperuser";
import ConsoleLogger from "utils/logging/consoleLogger";

const router = express.Router();

const VALID_MEDIA_TYPES: AssetOverrideMediaType[] = ["photo-time", "video-channel"];

const isValidMediaType = (val: unknown): val is AssetOverrideMediaType =>
  typeof val === "string" && (VALID_MEDIA_TYPES as string[]).includes(val);

// list all (returns lightweight items without overrideJson payload)
router.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const records = await getAssetOverridesList();
    res.status(200).json(records);
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the GET request ${e}` });
  }
});

// get full record by id
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const em = getORM().em;

  try {
    const record = await em.findOne(AssetOverride_db, { id: Number(id) });
    if (record) {
      res.status(200).json(record);
    } else {
      res.status(404).json({ status: "error", message: "asset override not found" });
    }
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the GET request ${e}` });
  }
});

// create or update
router.post("/", requireSuperuser, async (req: Request, res: Response): Promise<void> => {
  const { id, mediaType, source, startDate, endDate, overrideJson, notes } =
    req.body as AssetOverrideUpsertRequest;

  if (!isValidMediaType(mediaType)) {
    res.status(400).json({ status: "error", message: "Invalid mediaType" });
    return;
  }
  if (!overrideJson || typeof overrideJson !== "object" || Array.isArray(overrideJson)) {
    res.status(400).json({ status: "error", message: "overrideJson must be an object" });
    return;
  }

  const em = getORM().em;

  try {
    if (id) {
      const record = await em.findOne(AssetOverride_db, { id: Number(id) });
      if (record) {
        record.mediaType = mediaType;
        record.source = source;
        record.startDate = startDate;
        record.endDate = endDate;
        record.overrideJson = overrideJson;
        record.notes = notes;
        await em.persist(record).flush();
        res
          .status(200)
          .json({ status: "success", message: "asset override updated", data: record });
      } else {
        res.status(404).json({ status: "error", message: "asset override not found" });
      }
    } else {
      const record = em.create(AssetOverride_db, {
        mediaType,
        source,
        startDate,
        endDate,
        overrideJson,
        notes,
      });
      await em.persist(record).flush();
      res.status(201).json({ status: "success", message: "asset override inserted", data: record });
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
    const record = await em.findOne(AssetOverride_db, { id: Number(id) });
    if (record) {
      await em.remove(record).flush();
      res.status(200).json({ status: "success", message: "asset override deleted" });
    } else {
      res.status(404).json({ status: "error", message: "asset override not found" });
    }
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the DELETE request ${e}` });
  }
});

export default router;

export async function getAssetOverridesList(): Promise<AssetOverrideListItem[]> {
  const em = getORM().em.fork();
  const records = await em.find(
    AssetOverride_db,
    {},
    { orderBy: { mediaType: "ASC", source: "ASC", startDate: "ASC" } }
  );
  return records.map((r) => ({
    id: r.id,
    mediaType: r.mediaType,
    source: r.source,
    startDate: r.startDate,
    endDate: r.endDate,
    notes: r.notes,
    entryCount: r.overrideJson ? Object.keys(r.overrideJson).length : 0,
  }));
}

/**
 * Returns the merged override map for all rows matching mediaType + source whose
 * [startDate, endDate] range contains the requested yyyy-mm-dd date. If multiple rows
 * overlap, later rows win on key collisions (sorted by startDate ASC, id ASC).
 */
export async function getAssetOverridesForDate<T extends string | number>(
  mediaType: AssetOverrideMediaType,
  source: Source,
  requestedDate: string
): Promise<Record<string, T>> {
  const em = getORM().em.fork();
  const records = await em.find(
    AssetOverride_db,
    {
      mediaType,
      source,
      startDate: { $lte: requestedDate },
      endDate: { $gte: requestedDate },
    },
    { orderBy: { startDate: "ASC", id: "ASC" } }
  );
  const merged: Record<string, T> = {};
  for (const r of records) {
    if (!r.overrideJson) continue;
    Object.assign(merged, r.overrideJson);
  }
  return merged;
}
