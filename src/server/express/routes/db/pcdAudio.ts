import express, { Request, Response } from "express";
import { getORM } from "server/express/global";
import { PcdAudio_db } from "server/database/models/PcdAudio.model";
import { requireSuperuser } from "server/express/middleware/requireSuperuser";
import ConsoleLogger from "utils/logging/consoleLogger";

const router = express.Router();

// list all (lightweight — no full audioJson payload)
router.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const em = getORM().em.fork();
    const records = await em.find(PcdAudio_db, {}, { orderBy: { source: "ASC", id: "ASC" } });
    const items: PcdAudioListItem[] = records.map((r) => {
      const recordings = r.audioJson?.recordings ?? [];
      const dates = recordings
        .map((rec) => rec.startTime?.slice(0, 10))
        .filter((d): d is string => !!d)
        .sort();
      return {
        id: r.id,
        source: r.source,
        notes: r.notes,
        generatedAt: r.audioJson?.generatedAt ?? "",
        recordingCount: recordings.length,
        dateStart: dates[0] ?? null,
        dateEnd: dates[dates.length - 1] ?? null,
      };
    });
    res.status(200).json(items);
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
    const record = await em.findOne(PcdAudio_db, { id: Number(id) });
    if (record) {
      res.status(200).json(record);
    } else {
      res.status(404).json({ status: "error", message: "PCD audio record not found" });
    }
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the GET request ${e}` });
  }
});

// get audioJson for a source (for runtime consumption)
router.get("/source/:source", async (req: Request, res: Response): Promise<void> => {
  const source = req.params.source as Source;
  const em = getORM().em.fork();
  try {
    // Return the most recently inserted record for this source
    const record = await em.findOne(PcdAudio_db, { source }, { orderBy: { id: "DESC" } });
    if (record) {
      res.status(200).json(record.audioJson);
    } else {
      res.status(404).json({ status: "error", message: "No PCD audio record found for source" });
    }
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the GET request ${e}` });
  }
});

// create or update
router.post("/", requireSuperuser, async (req: Request, res: Response): Promise<void> => {
  const { id, source, notes, audioJson } = req.body as PcdAudioUpsertRequest;

  if (!audioJson || typeof audioJson !== "object" || !Array.isArray(audioJson.recordings)) {
    res
      .status(400)
      .json({ status: "error", message: "audioJson must be a valid PCD audio JSON object" });
    return;
  }

  const em = getORM().em;
  try {
    if (id) {
      const record = await em.findOne(PcdAudio_db, { id: Number(id) });
      if (record) {
        record.source = source;
        record.notes = notes;
        record.audioJson = audioJson;
        await em.persist(record).flush();
        res
          .status(200)
          .json({ status: "success", message: "PCD audio record updated", data: record });
      } else {
        res.status(404).json({ status: "error", message: "PCD audio record not found" });
      }
    } else {
      const record = em.create(PcdAudio_db, { source, notes, audioJson });
      await em.persist(record).flush();
      res
        .status(201)
        .json({ status: "success", message: "PCD audio record inserted", data: record });
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
    const record = await em.findOne(PcdAudio_db, { id: Number(id) });
    if (record) {
      await em.remove(record).flush();
      res.status(200).json({ status: "success", message: "PCD audio record deleted" });
    } else {
      res.status(404).json({ status: "error", message: "PCD audio record not found" });
    }
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the DELETE request ${e}` });
  }
});

export default router;
