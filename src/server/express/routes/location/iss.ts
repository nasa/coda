import getISSLocation from "server/processing/location/iss";
import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";

/**
 * `/api/v1/location/iss?year=yyyy&month=mm&date=dd`
 *
 * Get iss location using ephermis data (spacetrack or celestrak)
 */

const router = express.Router();

const parseQuery = (query: Query): GetEphemerisQueryParams => {
  const { dateWanted, forceNew } = query;
  const queryObj: GetEphemerisQueryParams = {
    dateWanted: dateWanted as string,
    forceNew: forceNew === "true",
  };
  return queryObj;
};

// get
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const queryObj = parseQuery(req.query);
  try {
    const data = await getISSLocation({
      dateWanted: queryObj.dateWanted,
      forceNew: queryObj.forceNew,
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
