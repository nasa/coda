import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";
import { fetchMTXAPIResponses } from "server/services/emss";

const router = express.Router();

const parseQuery = (query: Query): GetMTXPlaybackQueryParams => {
  const { source, forceNew } = query;
  const queryObj: GetMTXPlaybackQueryParams = {
    source: source ? (source as Source) : undefined,
    forceNew: forceNew === "true",
  };
  return queryObj;
};

// get
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const queryObj = parseQuery(req.query);
  try {
    const response = await fetchMTXAPIResponses({
      source: queryObj.source,
      forceNew: queryObj.forceNew,
    });
    res.status(200).json(response);
    return;
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
    return;
  }
});

export default router;
