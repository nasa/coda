import getPhotoData from "server/processing/media/photos";
import { Collection } from "utils/enums";
import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";

/**
 * `/api/media/photos`
 *
 * Get IO photo data proxied through our API
 */

const router = express.Router();

const parseQuery = (query: Query) => {
  const { year, month, date, collection, forceNew } = query;
  const queryObj = {
    year: year ? parseInt(year as string) : undefined,
    month: month ? parseInt(month as string) : undefined,
    date: date ? parseInt(date as string) : undefined,
    collection: collection ? (collection as string) : undefined,
    forceNew: forceNew === "1",
  };
  return queryObj;
};

// get
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const queryObj = parseQuery(req.query);
  try {
    const photos = await getPhotoData(
      queryObj.year,
      queryObj.month,
      queryObj.date,
      Collection[queryObj.collection],
      queryObj.forceNew
    );
    res.status(200).json(photos);
    return;
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
    return;
  }
});

export default router;
