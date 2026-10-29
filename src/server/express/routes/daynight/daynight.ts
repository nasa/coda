import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";
import { dataFetchConfigs, getSourceDateDataType } from "server/express/dataRetrievalScheduler";
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
 * `/api/v1/external/daynight/daynight?dateWanted=2021-01-01`
 *
 * Get day night data using the shared cache and polling schedule.
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
    if (!queryObj.dateWanted) {
      throw new Error("dateWanted is required");
    }

    const dataFetchConfig = dataFetchConfigs.find((config) => config.type === "daynight");
    if (!dataFetchConfig) {
      throw new Error("No fetch configuration registered for daynight");
    }

    const response = (await getSourceDateDataType({
      source: "ISS",
      dateWanted: queryObj.dateWanted,
      dataFetchConfig,
    })) as FetchResponse<DayNightStore> | null;

    // turn this into a legacy WrappedResponse for Maestro so they don't have to update anything
    const wrappedResponse: WrappedResponse<DayNightStore> = {
      responseMetadata: {
        retrieverStatus: response ? "complete" : "inprogress",
        cachedTimestamp: new Date().toISOString(),
        expiration: new Date(Date.now() + (response ? 24 * 60 * 60 * 1000 : 0)).toISOString(),
        error: "",
        retrieverErrorCount: 0,
        lastErrorTimestamp: "",
      },
      data: response?.data ?? { dayNight: [] },
    };

    res.status(200).json(wrappedResponse);
    return;
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    return;
  }
});

export default router;
