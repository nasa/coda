import getTestEventsData from "server/processing/sequences/test-events";
import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";
/**
 * `/api/sequences/rock-yard`
 *
 * Get all as-planned test event data in the wiki
 */

const router = express.Router();

const parseQuery = (query: Query): GetSequencesTestEventsQueryParams => {
  const { forceNew } = query;
  const queryObj: GetSequencesTestEventsQueryParams = {
    forceNew: forceNew === "true",
  };
  return queryObj;
};

// get
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const queryObj = parseQuery(req.query);
  try {
    const testEvents = await getTestEventsData({ forceNew: queryObj.forceNew });
    res.status(200).json(testEvents);
    return;
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
    return;
  }
});

export default router;
