import getTranscripts from "server/processing/emss/transcript";
import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";

const router = express.Router();

const parseQuery = (query: Query): GetTranscriptsQueryParams => {
  const { dateWanted, source, forceNew } = query;
  const queryObj: GetTranscriptsQueryParams = {
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
    const transcript = await getTranscripts({
      dateWanted: queryObj.dateWanted,
      source: queryObj.source,
    });
    res.status(200).json(transcript);
    return;
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
    return;
  }
});

export default router;
