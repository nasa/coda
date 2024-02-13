import getEVAData from "server/sequences/evas";
import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";

/**
 * `/api/sequences/evas`
 *
 * Query Params:
 *  agency=us|rs|all - default us
 *   if 'us', only US EVAs. if 'rs', only RS EVAs. if 'all', all EVAs
 *
 * Get all as-planned EVA data in the wiki
 */

const router = express.Router();

const parseQuery = (query: Query) => {
  const { agency = "us", forceNew } = query;
  const queryObj = {
    agency: agency ? (agency as string) : undefined,
    forceNew: forceNew === "1",
  };
  return queryObj;
};

// get
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const queryObj = parseQuery(req.query);
  try {
    const evas = await getEVAData(queryObj.agency as AgencyQuery, queryObj.forceNew);
    res.status(200).json(evas);
    return;
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
    return;
  }
});

export default router;
