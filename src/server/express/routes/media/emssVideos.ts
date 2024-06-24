import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";
import getEMSSVideoData from "server/processing/media/emssVideos";

/**
 * `/api/media/videos`
 *
 * Get EMSS video data proxied through our API
 */

const router = express.Router();

const parseQuery = (query: Query): GetVideosQueryParams => {
  const { dateWanted, source } = query;
  const queryObj: GetVideosQueryParams = {
    dateWanted: dateWanted as string,
    source: source ? (source as Source) : undefined,
  };
  return queryObj;
};

// get
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const queryObj = parseQuery(req.query);
  const [year, month, date] = queryObj.dateWanted.split("-").map((x) => parseInt(x, 10));

  try {
    const videos = await getEMSSVideoData({
      year,
      month,
      date,
      source: queryObj.source,
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
