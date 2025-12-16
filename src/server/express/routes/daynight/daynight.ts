import getDayNight from "server/processing/daynight";
import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";
import { ConsoleLogger } from "utils/logging/consoleLogger";

interface ResponseMetadata {
  retrieverStatus: FetchStatus;
  cachedTimestamp: string;
  expiration: string;
  error: string;
  retrieverErrorCount: number;
  lastErrorTimestamp: string;
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
  const { dateWanted, dayNightSource } = query;
  const queryObj: DayNightQueryParams = {
    dateWanted: dateWanted as string,
    dayNightSource: dayNightSource ? (dayNightSource as string) : undefined,
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
        dateWanted: queryObj.dateWanted,
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
    ConsoleLogger.error(e);
    res.status(400).json({ error: e.toString() });
    return;
  }
});

export default router;
