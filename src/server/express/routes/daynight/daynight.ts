import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";
import {
  dataFetchConfigs,
  getCacheStatusForDataType,
  getSourceDateDataType,
} from "server/express/dataRetrievalScheduler";
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
 * Get day night data. Served from the shared data cache rather than fetching TOPO
 * per request. A cache miss returns an empty result and starts a background fetch,
 * so a follow-up request for the same date is served from cache.
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
    // expired. Returns null when nothing has been cached for this date yet.
    const response = (await getSourceDateDataType({
      source: "ISS",
      dateWanted: queryObj.dateWanted,
      dataFetchConfig,
    })) as FetchResponse<DayNightStore> | null;

    // Read after the lookup above so the reported timestamps match the data being returned
    const cacheStatus = await getCacheStatusForDataType({
      source: "ISS",
      dateWanted: queryObj.dateWanted,
      dataFetchConfig,
    });

    const now = new Date().toISOString();
    const succeeded = response?.fetchMetadata?.success ?? false;
    const errorMessage = response?.fetchMetadata?.error ?? "";

    // A miss means a background fetch was just started, so report it as still in progress
    // and expire immediately to prompt the caller to ask again.
    let retrieverStatus: FetchStatus;
    if (!response) {
      retrieverStatus = "inprogress";
    } else if (succeeded) {
      retrieverStatus = "complete";
    } else {
      retrieverStatus = "error";
    }

    // turn this into a legacy WrappedResponse for Maestro so they don't have to update anything
    const wrappedResponse: WrappedResponse<DayNightStore> = {
      responseMetadata: {
        retrieverStatus,
        cachedTimestamp: cacheStatus?.cachedAt ?? now,
        expiration: cacheStatus?.expiration || now,
        error: retrieverStatus === "error" ? errorMessage : "",
        retrieverErrorCount: retrieverStatus === "error" ? 1 : 0,
        lastErrorTimestamp:
          retrieverStatus === "error" ? (response?.fetchMetadata?.timestamp ?? now) : "",
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
