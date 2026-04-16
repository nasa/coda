import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";
import { getORM } from "server/express/global";
import { VideoStartTimeOverrides_db } from "server/database/models/VideoStartTimeOverrides.model";
import { requireSuperuser } from "server/express/middleware/requireSuperuser";
import ConsoleLogger from "utils/logging/consoleLogger";

/**
 * Get videos datetime overrides from CODA DB for a given video id
 */

const router = express.Router();

const parseQuery = (query: Query): VideoQueryParams => {
  const { videoId } = query;
  const queryObj: VideoQueryParams = {
    videoId: videoId as string,
  };
  return queryObj;
};

// get by video id or get list if no date provided
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const queryObj = parseQuery(req.query);

  try {
    if (queryObj.videoId) {
      if (isNaN(parseFloat(queryObj.videoId))) {
        res.status(400).json({ status: "error", message: "Invalid video ID format" });
        return;
      }
      const record = await getVideoStartTimeOverridesRecordByVideoId(queryObj.videoId);
      res.status(200).json(record);
    } else {
      const records: VideoRecord[] = await getVideoStartTimeOverridesRecordsList();
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
    const videoRecord = await em.findOne(VideoStartTimeOverrides_db, {
      id: Number(id),
    });
    if (videoRecord) {
      res.status(200).json(videoRecord);
    } else {
      res.status(404).json({ status: "error", message: "video record not found" });
    }
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the GET request ${e}` });
  }
});

// create via post
router.post("/", requireSuperuser, async (req: Request, res: Response): Promise<void> => {
  const { id, videoId, startTime } = req.body as VideoUpsertRequest;
  const em = getORM().em;

  try {
    if (id) {
      const videoRecord = await em.findOne(VideoStartTimeOverrides_db, { id: Number(id) });
      if (videoRecord) {
        videoRecord.videoId = videoId;
        videoRecord.startTime = startTime;
        await em.persist(videoRecord).flush();
        res.status(200).json({
          status: "success",
          message: "video date time override updated",
          data: videoRecord,
        });
      } else {
        res.status(404).json({ status: "error", message: "video date time override not found" });
      }
    } else {
      const videoRecord: VideoRecord = em.create(VideoStartTimeOverrides_db, {
        videoId,
        startTime,
      });
      await em.persist(videoRecord).flush();
      res.status(201).json({
        status: "success",
        message: "video date time override inserted",
        data: videoRecord,
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
    const videoRecord = await em.findOne(VideoStartTimeOverrides_db, {
      id: Number(id),
    });
    if (videoRecord) {
      await em.remove(videoRecord).flush();
      res.status(200).json({ status: "success", message: "video deleted" });
    } else {
      res.status(404).json({ status: "error", message: "video not found" });
    }
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the DELETE request ${e}` });
  }
});

export default router;

async function getVideoStartTimeOverridesRecordByVideoId(
  videoId: string
): Promise<VideoRecord | null> {
  const em = getORM().em;
  const videoRecord = await em.findOne(VideoStartTimeOverrides_db, {
    videoId: videoId,
  });

  if (videoRecord) {
    return videoRecord;
  } else {
    return null;
  }
}

export async function getVideoStartTimeOverridesRecordsList(): Promise<VideoRecord[]> {
  const em = getORM().em.fork();
  const videos_db = await em.find(
    VideoStartTimeOverrides_db,
    {},
    { orderBy: { startTime: "ASC" }, fields: ["id", "videoId", "startTime"] }
  );
  if (videos_db) {
    return videos_db;
  } else {
    return [];
  }
}
