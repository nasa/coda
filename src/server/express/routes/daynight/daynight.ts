import getDayNight from "server/daynight/daynight";
import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";

/**
 * `/api/v1/daynight/daynight?year=yyyy&month=mm&date=dd`
 *
 * Get day night data
 */
const router = express.Router();

const parseQuery = (query: Query) => {
  const { year, month, date, forceNew, source } = query;
  const queryObj = {
    year: year ? parseInt(year as string) : undefined,
    month: month ? parseInt(month as string) : undefined,
    date: date ? parseInt(date as string) : undefined,
    forceNew: forceNew === "1",
    source: source ? (source as string) : undefined,
  };
  return queryObj;
};

// get
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const queryObj = parseQuery(req.query);
  try {
    const data = await getDayNight(
      queryObj.year,
      queryObj.month,
      queryObj.date,
      queryObj.forceNew,
      queryObj.source
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
