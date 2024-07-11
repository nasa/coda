import getGraphManifest from "server/processing/sequences/graph";
import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";

/**
 * Get graph manifest for specific date
 */

const router = express.Router();

const parseQuery = (query: Query): GetGraphsManifestQueryParams => {
  const { dateWanted, source } = query;
  const queryObj: GetGraphsManifestQueryParams = {
    dateWanted: dateWanted as string,
    source: source ? (source as Source) : undefined,
  };
  return queryObj;
};

// get
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const queryObj = parseQuery(req.query);
  try {
    const data = await getGraphManifest({
      dateWanted: queryObj.dateWanted,
      source: queryObj.source,
    });
    res.status(200).json(data);
    return;
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
    return;
  }
});

export default router;
