import getDayNight from "server/processing/daynight/daynight";
import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";

interface ResponseMetadata {
  retrieverStatus: FetchStatus;
  cachedTimestamp: string;
  expiration: string;
  error: string;
  retrieverErrorCount: number;
  lastErrorTimestamp: string;
  mocked?: boolean;
}

/** Legacy response type with caching concerns - to be phased out */
interface WrappedResponse<T> {
  data: T;
  responseMetadata: ResponseMetadata;
  source?: string;
}

/**
 * `/api/v1/daynight/daynight?dateWanted=2021-01-01
 *
 * Get day night data
 */
const router = express.Router();

const parseQuery = (query: Query): DayNightQueryParams => {
  // add support for year month date query params for Maestro
  //    remove when Maestro is updated to use dateWanted
  const { dateWanted, dayNightSource, year, month, date } = query;
  const queryObj: DayNightQueryParams = {
    dateWanted: dateWanted as string,
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
      const response = await getDayNight({
        dateWanted: `${queryObj.year}-${queryObj.month}-${queryObj.date}`,
        dayNightSource: queryObj.dayNightSource,
      });

      // turn this into a legacy WrappedResponse for Maestro so they don't have to update anything
      const wrappedResponse: WrappedResponse<DayNightStore> = {
        responseMetadata: {
          retrieverStatus: "complete",
          cachedTimestamp: new Date().toISOString(),
          expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          error: "",
          retrieverErrorCount: 0,
          lastErrorTimestamp: "",
        },
        data: response.data,
      };

      res.status(200).json(wrappedResponse);
    } else {
      const response = await getDayNight({
        dateWanted: queryObj.dateWanted,
        dayNightSource: queryObj.dayNightSource,
      });

      const wrappedResponse: WrappedResponse<DayNightStore> = {
        responseMetadata: {
          retrieverStatus: "complete",
          cachedTimestamp: new Date().toISOString(),
          expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          error: "",
          retrieverErrorCount: 0,
          lastErrorTimestamp: "",
        },
        data: response.data,
      };

      res.status(200).json(wrappedResponse);
    }
    return;
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
    return;
  }
});

export default router;
