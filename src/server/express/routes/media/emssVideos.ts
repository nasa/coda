import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";
import getEMSSVideoData from "server/processing/media/emssVideos";

/**
 * `/api/media/videos`
 *
 * Get EMSS video data proxied through our API
 */

const router = express.Router();

const parseQuery = (query: Query) => {
  const { year, month, date, collection } = query;
  const queryObj = {
    year: year ? parseInt(year as string) : undefined,
    month: month ? parseInt(month as string) : undefined,
    date: date ? parseInt(date as string) : undefined,
    collection: collection ? (collection as string) : undefined,
  };
  return queryObj;
};

// get
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const queryObj = parseQuery(req.query);

  try {
    const videos = await getEMSSVideoData(
      queryObj.year,
      queryObj.month,
      queryObj.date,
      parseInt(queryObj.collection)
    );
    res.status(200).json(videos);
    return;
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
    return;
  }
});

export default router;
