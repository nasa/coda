import getGPSTracks from "server/sequences/gps";
import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";

/**
 * /api/sequences/gps?year=yyyy&month=mm&date=dd&eventType=test_event
 *
 * Get gps tracks from wiki for a given date
 */

const router = express.Router();

const parseQuery = (query: Query) => {
  const { year, month, date, forceNew } = query;
  const queryObj = {
    year: year ? (year as string) : undefined,
    month: month ? (month as string) : undefined,
    date: date ? (date as string) : undefined,
    forceNew: forceNew === "1",
  };
  return queryObj;
};

// get
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const queryObj = parseQuery(req.query);
  try {
    const data = await getGPSTracks(
      `${queryObj.year}-${queryObj.month.padStart(2, "0")}-${queryObj.date.padStart(2, "0")}`,
      queryObj.forceNew
    );
    res.status(200).json(data);
    return;
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
    return;
  }
});

export default router;
