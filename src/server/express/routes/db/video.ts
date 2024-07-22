import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";
import { getEM } from "utils/mikro";
import { Loaded } from "@mikro-orm/core";
import { VideoStartTimeOverrides_db } from "server/database/models/VideoStartTimeOverrides.model";

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
      const record: VideoRecord = await getVideoRecordByVideoId(queryObj.videoId);
      const wrappedResponse: WrappedResponse<VideoRecord> = {
        responseMetadata: {
          retrieverStatus: "complete",
          cachedTimestamp: null,
          expiration: null,
          error: null,
          retrieverErrorCount: 0,
          lastErrorTimestamp: null,
        },
        source: "database",
        data: record,
      };
      res.status(200).json(wrappedResponse);
    } else {
      const records: VideoRecord[] = await getVideoRecordsList();
      const wrappedResponse: WrappedResponse<VideoRecord[]> = {
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
    const videoRecord: VideoRecord = await em.findOne(VideoStartTimeOverrides_db, {
      id: Number(id),
    });
    if (videoRecord) {
      const wrappedResponse: WrappedResponse<VideoRecord> = {
        responseMetadata: {
          retrieverStatus: "complete",
          cachedTimestamp: null,
          expiration: null,
          error: null,
          retrieverErrorCount: 0,
          lastErrorTimestamp: null,
        },
        source: "database",
        data: videoRecord,
      };
      res.status(200).json(wrappedResponse);
    } else {
      const wrappedResponse: WrappedResponse<VideoRecord> = {
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
    const wrappedResponse: WrappedResponse<VideoRecord> = {
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
  const { id, videoId, startTime } = req.body as VideoUpsertRequest;

  try {
    const em = getEM();
    if (id) {
      const videoRecord = await em.findOne(VideoStartTimeOverrides_db, { id: Number(id) });
      if (videoRecord) {
        videoRecord.videoId = videoId;
        videoRecord.startTime = startTime;
        await em.persistAndFlush(videoRecord);
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
      await em.persistAndFlush(videoRecord);
      res.status(201).json({
        status: "success",
        message: "video date time override inserted",
        data: videoRecord,
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
    const videoRecord: VideoRecord = await em.findOne(VideoStartTimeOverrides_db, {
      id: Number(id),
    });
    if (videoRecord) {
      await em.removeAndFlush(videoRecord);
      res.status(200).json({ status: "success", message: "video deleted" });
    } else {
      res.status(404).json({ status: "error", message: "video not found" });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: "error", message: `Error processing the DELETE request ${e}` });
  }
});

export default router;

async function getVideoRecordByVideoId(videoId: string): Promise<VideoRecord> {
  const em = getEM();

  let videoRecord: Loaded<VideoRecord, never>;
  videoRecord = await em.findOne(VideoStartTimeOverrides_db, { videoId: videoId });

  if (videoRecord) {
    const videoRecordData: VideoRecord = videoRecord;
    return videoRecordData;
  } else {
    return null;
  }
}

async function getVideoRecordsList(): Promise<VideoRecord[]> {
  const em = getEM();

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
