import getDayNight from "server/processing/daynight/daynight";
import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";

/**
 * `/api/v1/external/daynight/daynight?dateWanted=2021-01-01
 *
 * Get day night data
 */
const router = express.Router();

const parseQuery = (query: Query): DayNightQueryParams => {
  // add support for year month date query params for Maestro
  //    remove when Maestro is updated to use dateWanted
  const { dateWanted, forceNew, dayNightSource, year, month, date } = query;
  const queryObj: DayNightQueryParams = {
    dateWanted: dateWanted as string,
    forceNew: forceNew === "true",
    dayNightSource: dayNightSource ? (dayNightSource as string) : undefined,
    year: year ? parseInt(year as string) : undefined,
    month: month ? parseInt(month as string) : undefined,
    date: date ? parseInt(date as string) : undefined,
  };
  return queryObj;
};

// get
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const queryObj = parseQuery(req.query);
  try {
    // add support for year month date query params for Maestro
    //    remove when Maestro is updated to use dateWanted
    if (queryObj.year && queryObj.month && queryObj.date) {
      const data = await getDayNight({
        dateWanted: `${queryObj.year}-${queryObj.month}-${queryObj.date}`,
        forceNew: queryObj.forceNew,
        dayNightSource: queryObj.dayNightSource,
      });
      res.status(200).json(data);
    } else {
      const data = await getDayNight({
        dateWanted: queryObj.dateWanted,
        forceNew: queryObj.forceNew,
        dayNightSource: queryObj.dayNightSource,
      });
      res.status(200).json(data);
    }
    return;
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
    return;
  }
});

export default router;
