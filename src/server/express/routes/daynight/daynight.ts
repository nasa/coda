import getDayNight from "server/processing/daynight/daynight";
import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";

/**
 * `/api/v1/daynight/daynight?year=yyyy&month=mm&date=dd`
 *
 * Get day night data
 */
const router = express.Router();

const parseQuery = (query: Query): DayNightQueryParams => {
  const { dateWanted, forceNew, dayNightSource } = query;
  const queryObj: DayNightQueryParams = {
    dateWanted: dateWanted as string,
    forceNew: forceNew === "true",
    dayNightSource: dayNightSource ? (dayNightSource as string) : undefined,
  };
  return queryObj;
};

// get
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const queryObj = parseQuery(req.query);
  try {
    const data = await getDayNight({
      dateWanted: queryObj.dateWanted,
      forceNew: queryObj.forceNew,
      dayNightSource: queryObj.dayNightSource,
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
