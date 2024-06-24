import getVideoData from "server/processing/media/videos";
import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";

/**
 * `/api/media/videos`
 *
 * Get IO photo data proxied through our API
 */

const router = express.Router();

const parseQuery = (query: Query): GetVideosQueryParams => {
  const { dateWanted, source, forceNew } = query;
  const queryObj: GetVideosQueryParams = {
    dateWanted: dateWanted as string,
    source: source as Source,
    forceNew: forceNew === "true",
  };
  return queryObj;
};

// get
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const queryObj = parseQuery(req.query);
  try {
    const videos = await getVideoData({
      dateWanted: queryObj.dateWanted,
      source: queryObj.source,
      forceNew: queryObj.forceNew,
    });
    res.status(200).json(videos);
    return;
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
    return;
  }
});

export default router;
