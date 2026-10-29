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
 * Get day night data. Served from the shared data cache. The first request for a date
 * waits for the fetch, and later requests read the cached result.
 */
const router = express.Router();

const DATE_WANTED_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
    if (!queryObj.dateWanted || !DATE_WANTED_PATTERN.test(queryObj.dateWanted)) {
      res.status(400).json({ error: "dateWanted is required and must be in YYYY-MM-DD format" });
      return;
    }

    const dataFetchConfig = dataFetchConfigs.find((config) => config.type === "daynight");
    if (!dataFetchConfig) {
      res.status(500).json({ error: "No fetch configuration registered for daynight" });
      return;
    }

    // Returns cached data immediately (even if stale) and starts a background refresh when
    // expired. With nothing cached, waits for the fetch so the first request gets data.
    const response = (await getSourceDateDataType({
      source: "ISS",
      dateWanted: queryObj.dateWanted,
      dataFetchConfig,
      awaitFetchOnMiss: true,
    })) as FetchResponse<DayNightStore> | null;

    const now = new Date().toISOString();
    const succeeded = response?.fetchMetadata?.success ?? false;

    // turn this into a legacy WrappedResponse for Maestro so they don't have to update anything
    const wrappedResponse: WrappedResponse<DayNightStore> = {
      responseMetadata: {
        retrieverStatus: succeeded ? "complete" : "error",
        cachedTimestamp: response?.fetchMetadata?.timestamp ?? now,
        expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        error: succeeded ? "" : (response?.fetchMetadata?.error ?? "No day night data available"),
        retrieverErrorCount: succeeded ? 0 : 1,
        lastErrorTimestamp: succeeded ? "" : now,
      },
      data: response?.data ?? { dayNight: [] },
      source: response?.origin,
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
