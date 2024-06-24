import getLabsSgAudio from "server/processing/emss/sgAudio";
import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";

const router = express.Router();

const parseQuery = (query: Query): GetSgAudioQueryParams => {
  const { dateWanted, source, forceNew } = query;
  const queryObj: GetSgAudioQueryParams = {
    dateWanted: dateWanted as string,
    source: source ? (source as Source) : undefined,
    forceNew: forceNew === "true",
  };
  return queryObj;
};

// get
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const queryObj = parseQuery(req.query);
  try {
    const response = await getLabsSgAudio({
      dateWanted: queryObj.dateWanted,
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
