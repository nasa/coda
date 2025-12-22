import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import getVideoData from "server/processing/io-videos";
import { globalValues } from "./global";
import { emitDataUpdate, emitFetchInspectorUpdate } from "./sockets";
import getDayNight from "server/processing/daynight";
import getEphemera from "server/processing/ephemeris";
import getPhotoData from "server/processing/io-photos";
import getGpsTrackData from "server/processing/gps";
import { getMTXAPIResponses } from "server/processing/mediaMtx";
import getTalkybotData from "server/processing/talkybot";
import getGraphManifest from "server/processing/graphs";
import { getISSEvaData, getTestEventsData } from "server/processing/wikiData";
import { ConsoleLogger } from "../../utils/logging/consoleLogger";
import isEqual from "lodash/isEqual";
import { getCacheEntry, putCacheEntry } from "server/express/cache-db";
import { isDataTypeValidForSourceAndDate } from "utils/sourceDataTypeMap";

dayjs.extend(duration);

const DEFAULT_REFRESH_INTERVAL_MS_TODAY = dayjs.duration(2, "minutes").asMilliseconds(); // refresh cache every 2 minutes for "today"
const DEFAULT_REFRESH_INTERVAL_MS = dayjs.duration(1, "hour").asMilliseconds(); // refresh cache every 60 minutes by default
const DEFAULT_DATA_FETCH_TIMEOUT_MS = dayjs.duration(30, "seconds").asMilliseconds(); // 30 seconds

export const dataFetchConfigs: FetchConfig[] = [
  {
    type: "daynight",
    getDataFunction: getDayNight,
    refreshIntervalTodayMs: dayjs.duration(3, "hours").asMilliseconds(), // 3 hours for today's data
    refreshIntervalMs: dayjs.duration(12, "hours").asMilliseconds(), // 12 hours for other days
    fetchTimeoutMs: dayjs.duration(60, "seconds").asMilliseconds(), // 60 seconds (allows for TOPO failure + ephemeris db fallback)
    enableCacheUse: true,
  },
  {
    type: "ephemeris",
    getDataFunction: getEphemera,
    refreshIntervalTodayMs: null, // No polling - updates pushed via celestrakScheduler after TLE fetch
    refreshIntervalMs: null,
    fetchTimeoutMs: DEFAULT_DATA_FETCH_TIMEOUT_MS,
    enableCacheUse: false, // Data retrieved from local database (no caching needed)
  },
  {
    type: "videos",
    getDataFunction: getVideoData,
    refreshIntervalTodayMs: DEFAULT_REFRESH_INTERVAL_MS_TODAY,
    refreshIntervalMs: dayjs.duration(15, "minutes").asMilliseconds(), // 15 minutes for other days (faster than 60 min default)
    fetchTimeoutMs: DEFAULT_DATA_FETCH_TIMEOUT_MS,
    enableCacheUse: true,
  },
  {
    type: "photos",
    getDataFunction: getPhotoData,
    refreshIntervalTodayMs: DEFAULT_REFRESH_INTERVAL_MS_TODAY,
    refreshIntervalMs: dayjs.duration(15, "minutes").asMilliseconds(), // 15 minutes for other days (faster than 60 min default)
    fetchTimeoutMs: DEFAULT_DATA_FETCH_TIMEOUT_MS,
    enableCacheUse: true,
  },
  {
    type: "wikiEvas",
    getDataFunction: getISSEvaData,
    refreshIntervalTodayMs: null, // Static data from JSON file - no refresh needed
    refreshIntervalMs: null,
    fetchTimeoutMs: DEFAULT_DATA_FETCH_TIMEOUT_MS,
    enableCacheUse: false, // Static data from JSON file (no caching needed)
  },
  {
    type: "wikiTestEvents",
    getDataFunction: getTestEventsData,
    refreshIntervalTodayMs: null, // Static data from JSON file - no refresh needed
    refreshIntervalMs: null,
    fetchTimeoutMs: DEFAULT_DATA_FETCH_TIMEOUT_MS,
    enableCacheUse: false, // Static data from JSON file (no caching needed)
  },
  {
    type: "mtxvideo",
    getDataFunction: getMTXAPIResponses,
    refreshIntervalTodayMs: DEFAULT_REFRESH_INTERVAL_MS_TODAY,
    refreshIntervalMs: DEFAULT_REFRESH_INTERVAL_MS,
    fetchTimeoutMs: DEFAULT_DATA_FETCH_TIMEOUT_MS,
    enableCacheUse: true,
  },
  {
    type: "gpstracks",
    getDataFunction: getGpsTrackData,
    refreshIntervalTodayMs: null, // No polling - DB-sourced, use force refresh via admin page if needed
    refreshIntervalMs: null,
    fetchTimeoutMs: DEFAULT_DATA_FETCH_TIMEOUT_MS,
    enableCacheUse: false, // Data retrieved from local database (no caching needed)
  },
  {
    type: "talkybot",
    getDataFunction: getTalkybotData,
    refreshIntervalTodayMs: null, // No polling - updates come via talkybotS2sSocket incremental updates
    refreshIntervalMs: null,
    fetchTimeoutMs: DEFAULT_DATA_FETCH_TIMEOUT_MS,
    enableCacheUse: false, // Always fetch fresh data from talkybot
  },
  {
    type: "graph",
    getDataFunction: getGraphManifest,
    refreshIntervalTodayMs: null, // No polling - DB-sourced, use force refresh via admin page if needed
    refreshIntervalMs: null,
    fetchTimeoutMs: DEFAULT_DATA_FETCH_TIMEOUT_MS,
    enableCacheUse: false, // Data retrieved from local database (no caching needed)
  },
];

// returns existing fetch tracker data or initializes an empty fetch tracker entry if it doesn't exist
const ensureFetchTrackerEntry = (
  source: Source,
  dateWanted: string,
  dataType: StoreDataType
): FetchTrackerData => {
  let mutated = false;

  if (!globalValues.fetchTrackers[source]) {
    globalValues.fetchTrackers[source] = {};
    mutated = true;
  }

  if (!globalValues.fetchTrackers[source][dateWanted]) {
    globalValues.fetchTrackers[source][dateWanted] = {};
    mutated = true;
  }

  if (!globalValues.fetchTrackers[source][dateWanted][dataType]) {
    globalValues.fetchTrackers[source][dateWanted][dataType] = {
      isFetching: false,
    };
    mutated = true;
  }

  if (mutated) {
    emitFetchInspectorUpdate();
  }

  return globalValues.fetchTrackers[source][dateWanted][dataType];
};

const updateFetchTracker = (
  source: Source,
  dateWanted: string,
  dataType: StoreDataType,
  updates: Partial<FetchTrackerData>
): FetchTrackerData => {
  const tracker = ensureFetchTrackerEntry(source, dateWanted, dataType);
  let changed = false;
  type TrackerKey = keyof FetchTrackerData;
  const entries = Object.entries(updates) as Array<[TrackerKey, FetchTrackerData[TrackerKey]]>;
  const trackerRecord = tracker as Record<TrackerKey, FetchTrackerData[TrackerKey]>;

  entries.forEach(([key, value]) => {
    if (trackerRecord[key] !== value) {
      trackerRecord[key] = value;
      changed = true;
    }
  });

  if (changed) {
    emitFetchInspectorUpdate();
  }

  return tracker;
};

const clearTrackerDataTimeout = (source: Source, dateWanted: string, dataType: StoreDataType) => {
  const status = ensureFetchTrackerEntry(source, dateWanted, dataType);
  if (status.timeoutObject) {
    clearTimeout(status.timeoutObject);
    ConsoleLogger.debug(`${dataType} Cleared existing timeout for ${source}_${dateWanted}`);
  }
  updateFetchTracker(source, dateWanted, dataType, {
    timeoutDelayMs: undefined,
    timeoutCreatedAt: undefined,
    nextTimeoutTriggerAt: undefined,
    timeoutObject: undefined,
  });
};

// creates a new timeout object and updates the fetch tracker accordingly
const createTimeoutObject = ({
  source,
  dateWanted,
  dataType,
  timeoutCallback,
  delay,
}: {
  source: Source;
  dateWanted: string;
  dataType: string;
  timeoutCallback: () => void | Promise<void>;
  delay: number;
}) => {
  const dataTypeKey = dataType as StoreDataType;
  const status = ensureFetchTrackerEntry(source, dateWanted, dataTypeKey);

  // Clear existing timeout if it exists
  if (status.timeoutObject) {
    clearTrackerDataTimeout(source, dateWanted, dataTypeKey);
  }

  ConsoleLogger.debug(
    `${dataType} Setting timeout for ${source}_${dateWanted} with delay ${delay / 1000}s`
  );
  const createdAt = Date.now();
  const nextRefreshAt = createdAt + delay;

  // make new timeout
  const timeout = setTimeout(async () => {
    updateFetchTracker(source, dateWanted, dataTypeKey, {
      lastTimeoutTriggeredAt: new Date().toISOString(),
      timeoutDelayMs: undefined,
      timeoutCreatedAt: undefined,
      nextTimeoutTriggerAt: undefined,
      timeoutObject: undefined,
    });
    try {
      await timeoutCallback();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown timeout callback error";
      ConsoleLogger.error(
        `${dataType} Error during scheduled refresh for ${source}_${dateWanted}: ${message}`
      );
    }
  }, delay);

  updateFetchTracker(source, dateWanted, dataTypeKey, {
    timeoutDelayMs: delay,
    timeoutCreatedAt: new Date(createdAt).toISOString(),
    nextTimeoutTriggerAt: new Date(nextRefreshAt).toISOString(),
    timeoutObject: timeout,
  });
};

// calculates delay to pass into the timeout function based on expiration time
// randomizes the timeout slightly to avoid many timeouts firing simultaneously
const calculateTimeoutDelayFromExpiration = (
  expiration: string,
  bufferMs: number = 1000
): number => {
  // Maximum timeout of 24 hours
  // Prevents potential integer overflow issues in Node.js setTimeout
  const maxTimeout = dayjs.duration(24, "hours").asMilliseconds();

  // If expiration is null, return 60 seconds +- 5 seconds
  if (!expiration)
    return (
      dayjs.duration(60, "seconds").asMilliseconds() + Math.floor(Math.random() * 10000) - 5000
    );

  const expirationTime = new Date(expiration).getTime();
  const timeUntilExpiration = expirationTime - Date.now();

  // If the expiration time is in the past, return 60 seconds +- 5 seconds
  if (timeUntilExpiration <= 0)
    return (
      dayjs.duration(60, "seconds").asMilliseconds() + Math.floor(Math.random() * 10000) - 5000
    );

  if (timeUntilExpiration > maxTimeout) {
    ConsoleLogger.debug(
      `Reducing timeout from ${timeUntilExpiration / 1000}s to ${maxTimeout / 1000}s to avoid overflow`
    );
    return maxTimeout;
  }
  return timeUntilExpiration + bufferMs;
};

// Helper function for fetch and retry logic. Updates fetch tracker accordingly.
const fetchData = async ({
  config,
  dateWanted,
  source,
}: {
  config: FetchConfig;
  dateWanted: string;
  source: Source;
}): Promise<FetchResponse<any>> => {
  if (!dateWanted || !source) {
    ConsoleLogger.error(`No dateWanted or source provided for ${config.type} fetchData`);
    return null;
  }

  const dataType = config.type;
  const fetchStartedAt = new Date();

  updateFetchTracker(source, dateWanted, dataType, {
    isFetching: true,
    fetchStartedAt: fetchStartedAt.toISOString(),
  });

  let dataResponse: FetchResponse<any>;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    // call the actual fetch function and get the data, race this against a timeout promise to avoid hanging
    const timeoutPromise = new Promise<FetchResponse<any>>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`Timeout after ${config.fetchTimeoutMs}ms`)),
        config.fetchTimeoutMs
      );
    });

    dataResponse = await Promise.race([
      config.getDataFunction({
        dateWanted,
        source,
      }),
      timeoutPromise,
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown data fetch error";
    ConsoleLogger.error(
      `${config.type} Error fetching data for ${source}_${dateWanted}: ${message}`
    );
    dataResponse = {
      data: null,
      fetchMetadata: {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      },
    };
  }

  const fetchCompletedAt = new Date();
  const durationMs = fetchCompletedAt.getTime() - fetchStartedAt.getTime();
  const succeeded = Boolean(dataResponse?.fetchMetadata?.success);

  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  updateFetchTracker(source, dateWanted, dataType, {
    isFetching: false,
    fetchStartedAt: undefined,
    lastOperationStartedAt: fetchStartedAt.toISOString(),
    lastOperationCompletedAt: fetchCompletedAt.toISOString(),
    lastOperationDurationMs: durationMs,
    lastOperationSuccess: succeeded,
    ...(succeeded
      ? {
          lastSuccessAt: fetchCompletedAt.toISOString(),
          lastErrorAt: undefined,
          lastErrorMessage: undefined,
        }
      : {
          lastErrorAt: fetchCompletedAt.toISOString(),
          lastErrorMessage: dataResponse?.fetchMetadata?.error,
        }),
  });

  return dataResponse;
};

// Main function to get data
// Calls either a background fetch function, or a direct fetch if the data doesn't use the cache
export const getSourceDateDataType = async ({
  source,
  dateWanted,
  dataFetchConfig,
  autoRefresh = true, // autoRefresh means to schedule background refreshes after fetching. Currently false only for manual data downloads API endpoint
}: {
  source: Source;
  dateWanted: string;
  dataFetchConfig: FetchConfig;
  autoRefresh?: boolean;
}): Promise<FetchResponse<any>> => {
  const dataType = dataFetchConfig.type;

  // Check if this data type is valid for this source and date (e.g., mtxvideo not valid for dates > 7 days ago)
  if (
    !isDataTypeValidForSourceAndDate(
      source,
      dataType,
      dateWanted,
      parseInt(process.env.VITE_PUBLIC_MTX_VIDEO_MAX_AGE_DAYS)
    )
  ) {
    ConsoleLogger.debug(
      `${dataType} Skipping for ${source}_${dateWanted} (not valid for this source/date combination)`
    );
    return null;
  }

  // If enableCacheUse is false, fetch data directly without using cache
  if (!dataFetchConfig.enableCacheUse) {
    ConsoleLogger.debug(
      `${dataType} Skipping cache for ${source}_${dateWanted} (enableCacheUse disabled)`
    );
    const dataResponse = await fetchData({
      source,
      dateWanted,
      config: dataFetchConfig,
    });

    return dataResponse;
  }

  const cachePath = `socketDataCache/${source}/${dateWanted}`;
  const cacheEntry = await getCacheEntry({ folder: cachePath, identifier: dataFetchConfig.type });

  ensureFetchTrackerEntry(source, dateWanted, dataType);

  if (cacheEntry?.metadata?.expiration) {
    updateFetchTracker(source, dateWanted, dataType, {
      cacheExpiration: cacheEntry.metadata.expiration,
    });
  }

  // Check if cache is expired
  const isExpired = cacheEntry?.metadata?.expiration
    ? Date.now() > new Date(cacheEntry.metadata.expiration).getTime()
    : true;

  // Determine if we have valid cached data to return
  const hasCachedData = cacheEntry && cacheEntry.data !== null && cacheEntry.data !== undefined;

  // Check if we're already fetching
  const status = ensureFetchTrackerEntry(source, dateWanted, dataType);
  const isAlreadyFetching = status.isFetching && status.fetchStartedAt;

  // Determine if we need to fetch
  const needsFetch = isExpired || !hasCachedData;

  // Start background fetch if needed and not already fetching
  if (needsFetch && !isAlreadyFetching && autoRefresh) {
    ConsoleLogger.debug(
      `${dataFetchConfig.type} Starting background fetch for ${source}_${dateWanted} (expired: ${isExpired}, hasCache: ${hasCachedData})`
    );

    // Fire and forget - don't await
    performBackgroundFetch({
      source,
      dateWanted,
      dataFetchConfig,
      cachePath,
      autoRefresh,
    }).catch((error) => {
      ConsoleLogger.error(
        `${dataFetchConfig.type} Error in background fetch for ${source}_${dateWanted}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    });
  } else if (isAlreadyFetching) {
    ConsoleLogger.debug(
      `${dataFetchConfig.type} Already fetching for ${source}_${dateWanted}, skipping duplicate fetch`
    );
  }

  // If cache is NOT expired and autoRefresh is enabled, ensure new timeout is scheduled
  if (!isExpired && hasCachedData && autoRefresh) {
    const status = globalValues.fetchTrackers?.[source]?.[dateWanted]?.[dataFetchConfig.type];
    if (!status?.timeoutObject) {
      const delay = calculateTimeoutDelayFromExpiration(cacheEntry.metadata.expiration);
      if (delay > 0) {
        createTimeoutObject({
          source,
          dateWanted,
          dataType: dataFetchConfig.type,
          timeoutCallback: async () => {
            ConsoleLogger.debug(
              `${dataFetchConfig.type} Timeout triggered refresh for ${source}_${dateWanted}`
            );
            await performBackgroundFetch({
              source,
              dateWanted,
              dataFetchConfig,
              cachePath,
              autoRefresh,
            });
          },
          delay,
        });
      }
    }
  }

  // Return cached data if available (even if expired), otherwise null
  if (hasCachedData) {
    ConsoleLogger.debug(
      `${dataFetchConfig.type} Returning cached data for ${source}_${dateWanted} (expired: ${isExpired})`
    );
    updateFetchTracker(source, dateWanted, dataType, {
      lastCacheHitAt: new Date().toISOString(),
      lastOperationSuccess: (cacheEntry.data as any)?.metadata?.success ?? true,
    });
    return cacheEntry.data as FetchResponse<any>;
  }

  // No cache available
  ConsoleLogger.debug(`${dataFetchConfig.type} No cache for ${source}_${dateWanted}`);
  updateFetchTracker(source, dateWanted, dataType, {
    lastCacheMissAt: new Date().toISOString(),
  });
  return null;
};

/**
 * Performs a background fetch, updates cache, emits to clients, and schedules next refresh
 */
const performBackgroundFetch = async ({
  source,
  dateWanted,
  dataFetchConfig,
  cachePath,
  autoRefresh,
}: {
  source: Source;
  dateWanted: string;
  dataFetchConfig: FetchConfig;
  cachePath: string;
  autoRefresh: boolean;
}): Promise<void> => {
  const dataType = dataFetchConfig.type;

  // Get current cache for comparison later
  const currentCacheEntry = await getCacheEntry({ folder: cachePath, identifier: dataType });

  // Fetch new data
  const dataResponse = await fetchData({
    source,
    dateWanted,
    config: dataFetchConfig,
  });

  if (!dataResponse?.fetchMetadata?.success) {
    ConsoleLogger.error(
      `${dataFetchConfig.type} Error getting data for ${dateWanted}. Message: ${dataResponse?.fetchMetadata?.error}`
    );
  }

  // Calculate next expiration time
  const today = new Date().toISOString().split("T")[0];
  const isToday = dateWanted === today;
  const baseRefreshInterval = isToday
    ? dataFetchConfig.refreshIntervalTodayMs
    : dataFetchConfig.refreshIntervalMs;

  // If refresh interval is null, no automatic refreshing should occur
  const shouldScheduleRefresh = baseRefreshInterval !== null && autoRefresh;

  let expirationISO: string | undefined;
  if (shouldScheduleRefresh) {
    const randomFactor = 0.8 + Math.random() * 0.4; // ±20% randomness
    const randomizedInterval = Math.floor(baseRefreshInterval * randomFactor);
    expirationISO = new Date(Date.now() + randomizedInterval).toISOString();
  }

  // Update cache with new data
  await putCacheEntry({
    folder: cachePath,
    identifier: dataType,
    data: dataResponse?.fetchMetadata?.success ? dataResponse : currentCacheEntry?.data,
    metadata: {
      expiration:
        dataResponse?.fetchMetadata?.success && expirationISO
          ? expirationISO
          : currentCacheEntry?.metadata?.expiration,
    },
  });

  // Schedule next refresh if refresh interval is configured and autoRefresh is enabled
  if (shouldScheduleRefresh && expirationISO) {
    const delay = calculateTimeoutDelayFromExpiration(expirationISO);
    if (delay > 0) {
      createTimeoutObject({
        source,
        dateWanted,
        dataType: dataFetchConfig.type,
        timeoutCallback: async () => {
          ConsoleLogger.debug(
            `${dataFetchConfig.type} Timeout triggered refresh for ${source}_${dateWanted}`
          );
          await performBackgroundFetch({
            source,
            dateWanted,
            dataFetchConfig,
            cachePath,
            autoRefresh,
          });
        },
        delay,
      });
    }
  } else if (baseRefreshInterval === null) {
    ConsoleLogger.debug(
      `${dataFetchConfig.type} No automatic refresh scheduled for ${source}_${dateWanted} (refreshInterval is null)`
    );
  }

  // Emit to all clients only if data changed
  const previousData = (currentCacheEntry?.data as FetchResponse<any>)?.data;
  if (!isEqual(dataResponse?.data, previousData)) {
    ConsoleLogger.debug(
      `${dataFetchConfig.type} Emitting data update to room for ${source}_${dateWanted}`
    );

    emitDataUpdate({
      source,
      dataDate: dateWanted,
      dataUpdate: { type: dataFetchConfig.type, response: dataResponse },
    });
    updateFetchTracker(source, dateWanted, dataType, {
      lastEmitAt: new Date().toISOString(),
    });
  } else {
    ConsoleLogger.debug(
      `${dataFetchConfig.type} Data unchanged for ${source}_${dateWanted}, skipping emit`
    );
    updateFetchTracker(source, dateWanted, dataType, {
      lastEmitSkippedAt: new Date().toISOString(),
    });
  }
};

/**
 * Force refresh a specific data type by expiring the cache and triggering a fetch.
 * Always emits to clients, regardless of whether data changed.
 */
export const forceRefreshDataType = async ({
  source,
  dateWanted,
  dataType,
}: {
  source: Source;
  dateWanted: string;
  dataType: StoreDataType;
}): Promise<{ success: boolean; data?: FetchResponse<any>; error?: string }> => {
  try {
    // Check if this data type is valid for this source and date
    if (
      !isDataTypeValidForSourceAndDate(
        source,
        dataType,
        dateWanted,
        parseInt(process.env.VITE_PUBLIC_MTX_VIDEO_MAX_AGE_DAYS)
      )
    ) {
      const errorMsg = `Data type ${dataType} is not available for source ${source} on ${dateWanted}`;
      ConsoleLogger.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    // Find the data fetch config for this data type
    const config = dataFetchConfigs.find((c) => c.type === dataType);
    if (!config) {
      const errorMsg = `No configuration found for data type: ${dataType}`;
      ConsoleLogger.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    ConsoleLogger.debug(`${dataType} Force refresh requested for ${source}_${dateWanted}`);

    // If this data type uses cache, expire it first
    if (config.enableCacheUse) {
      clearTrackerDataTimeout(source, dateWanted, dataType);

      const cachePath = `socketDataCache/${source}/${dateWanted}`;
      const currentCacheEntry = await getCacheEntry({ folder: cachePath, identifier: dataType });
      const expiredTimestamp = new Date(Date.now() - 10000).toISOString();

      if (currentCacheEntry) {
        await putCacheEntry({
          folder: cachePath,
          identifier: dataType,
          data: currentCacheEntry.data,
          metadata: { expiration: expiredTimestamp },
        });
      }

      updateFetchTracker(source, dateWanted, dataType, { cacheExpiration: expiredTimestamp });
    }

    // Fetch fresh data
    const dataResponse = await getSourceDateDataType({
      source,
      dateWanted,
      dataFetchConfig: config,
      autoRefresh: config.enableCacheUse, // Only auto-refresh for cached types
    });

    // Always emit on force refresh
    if (dataResponse) {
      emitDataUpdate({
        source,
        dataDate: dateWanted,
        dataUpdate: { type: dataType, response: dataResponse },
      });
      updateFetchTracker(source, dateWanted, dataType, { lastEmitAt: new Date().toISOString() });
    }

    ConsoleLogger.debug(
      `${dataType} Force refresh completed for ${source}_${dateWanted}. Success: ${dataResponse?.fetchMetadata?.success}`
    );

    return { success: true, data: dataResponse };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error during force refresh";
    ConsoleLogger.error(`${dataType} Error during force refresh: ${message}`);
    return { success: false, error: message };
  }
};
