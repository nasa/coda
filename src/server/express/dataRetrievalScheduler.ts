import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import getVideoData from "server/processing/io-videos";
import { globalValues } from "./global";
import { emitDataUpdate, emitDataUpdateToSource, emitFetchInspectorUpdate } from "./sockets";
import getDayNight from "server/processing/daynight";
import getEphemera from "server/processing/ephemeris/ephemeris";
import getPhotoData from "server/processing/io-photos";
import getGpsTrackData from "server/processing/gps";
import { getMTXAPIResponses } from "server/processing/mediaMtx";
import getTalkybotData from "server/processing/talkybot";
import getGraphManifest from "server/processing/graphs";
import getPcdAudioData from "server/processing/pcdAudio";
import { getISSEvaData } from "server/processing/wiki/evaData";
import { getTestEventsData } from "server/processing/wiki/testEventData";
import { ConsoleLogger } from "../../utils/logging/consoleLogger";
import isEqual from "lodash/isEqual";
import { getCacheEntry, putCacheEntry } from "server/express/cache-db";
import { isDataTypeValidForSourceAndDate } from "utils/sourceDataTypeMap";

dayjs.extend(duration);

const DEFAULT_REFRESH_INTERVAL_MS_TODAY = dayjs.duration(2, "minutes").asMilliseconds(); // refresh cache every 2 minutes for "today"
const DEFAULT_REFRESH_INTERVAL_MS = dayjs.duration(1, "hour").asMilliseconds(); // refresh cache every 60 minutes by default
const DEFAULT_DATA_FETCH_TIMEOUT_MS = dayjs.duration(30, "seconds").asMilliseconds(); // 30 seconds

// Key used for non-date-dependent data in fetch tracker (e.g., wiki data that's the same for all dates)
export const ALL_DATES_KEY = "notDateDependent";

export const dataFetchConfigs: FetchConfig[] = [
  {
    type: "daynight",
    getDataFunction: getDayNight,
    refreshIntervalTodayMs: dayjs.duration(3, "hours").asMilliseconds(), // 3 hours for today's data
    refreshIntervalMs: dayjs.duration(12, "hours").asMilliseconds(), // 12 hours for other days
    fetchTimeoutMs: dayjs.duration(60, "seconds").asMilliseconds(), // 60 seconds (allows for TOPO failure + ephemeris db fallback)
    enableCacheUse: true,
    isDateDependent: true,
  },
  {
    type: "ephemeris",
    getDataFunction: getEphemera,
    refreshIntervalTodayMs: null, // No polling - updates pushed via spacetrackScheduler after TLE fetch
    refreshIntervalMs: null,
    fetchTimeoutMs: DEFAULT_DATA_FETCH_TIMEOUT_MS,
    enableCacheUse: false, // Data retrieved from local database (no caching needed)
    isDateDependent: true,
  },
  {
    type: "videos",
    getDataFunction: getVideoData,
    refreshIntervalTodayMs: DEFAULT_REFRESH_INTERVAL_MS_TODAY,
    refreshIntervalMs: dayjs.duration(15, "minutes").asMilliseconds(), // 15 minutes for other days (faster than 60 min default)
    fetchTimeoutMs: DEFAULT_DATA_FETCH_TIMEOUT_MS,
    enableCacheUse: true,
    isDateDependent: true,
  },
  {
    type: "photos",
    getDataFunction: getPhotoData,
    refreshIntervalTodayMs: DEFAULT_REFRESH_INTERVAL_MS_TODAY,
    refreshIntervalMs: dayjs.duration(15, "minutes").asMilliseconds(), // 15 minutes for other days (faster than 60 min default)
    fetchTimeoutMs: DEFAULT_DATA_FETCH_TIMEOUT_MS,
    enableCacheUse: true,
    isDateDependent: true,
  },
  {
    type: "wikiEvas",
    getDataFunction: getISSEvaData,
    refreshIntervalTodayMs: dayjs.duration(6, "hour").asMilliseconds(),
    refreshIntervalMs: null, // Not used for non-date-dependent data
    fetchTimeoutMs: dayjs.duration(60, "seconds").asMilliseconds(), // Allow more time for wiki API
    enableCacheUse: true, // Cache wiki data to reduce API calls
    isDateDependent: false, // Wiki data is the same for all dates
  },
  {
    type: "wikiTestEvents",
    getDataFunction: getTestEventsData,
    refreshIntervalTodayMs: dayjs.duration(6, "hour").asMilliseconds(),
    refreshIntervalMs: null, // Not used for non-date-dependent data
    fetchTimeoutMs: dayjs.duration(60, "seconds").asMilliseconds(), // Allow more time for wiki API
    enableCacheUse: true, // Cache wiki data to reduce API calls
    isDateDependent: false, // Wiki data is the same for all dates
  },
  {
    type: "mtxvideo",
    getDataFunction: getMTXAPIResponses,
    refreshIntervalTodayMs: DEFAULT_REFRESH_INTERVAL_MS_TODAY,
    refreshIntervalMs: DEFAULT_REFRESH_INTERVAL_MS,
    fetchTimeoutMs: DEFAULT_DATA_FETCH_TIMEOUT_MS,
    enableCacheUse: true,
    isDateDependent: true,
  },
  {
    type: "gpstracks",
    getDataFunction: getGpsTrackData,
    refreshIntervalTodayMs: null, // No polling - DB-sourced, use force refresh via admin page if needed
    refreshIntervalMs: null,
    fetchTimeoutMs: DEFAULT_DATA_FETCH_TIMEOUT_MS,
    enableCacheUse: false, // Data retrieved from local database (no caching needed)
    isDateDependent: true,
  },
  {
    type: "talkybot",
    getDataFunction: getTalkybotData,
    refreshIntervalTodayMs: null, // No polling - updates come via talkybotS2sSocket incremental updates
    refreshIntervalMs: null,
    fetchTimeoutMs: DEFAULT_DATA_FETCH_TIMEOUT_MS,
    enableCacheUse: false, // Always fetch fresh data from talkybot
    isDateDependent: true,
  },
  {
    type: "graph",
    getDataFunction: getGraphManifest,
    refreshIntervalTodayMs: null, // No polling - DB-sourced, use force refresh via admin page if needed
    refreshIntervalMs: null,
    fetchTimeoutMs: DEFAULT_DATA_FETCH_TIMEOUT_MS,
    enableCacheUse: false, // Data retrieved from local database (no caching needed)
    isDateDependent: true,
  },
  {
    type: "pcdAudio",
    getDataFunction: getPcdAudioData,
    refreshIntervalTodayMs: null, // No polling - DB-sourced; re-emit when admin updates the record
    refreshIntervalMs: null,
    fetchTimeoutMs: DEFAULT_DATA_FETCH_TIMEOUT_MS,
    enableCacheUse: false, // Data retrieved from local database (no caching needed)
    isDateDependent: false, // All recordings for a mission are in one record, filtered client-side
  },
];

/**
 * Helper to get cache path and tracker date key for a data type.
 * Date-dependent data uses per-date keys. Non-date-dependent data (e.g., wiki) uses allDates keys.
 */
const getCacheAndTrackerKeys = (
  config: FetchConfig,
  source: Source,
  dateWanted: string
): { cachePath: string; trackerDateKey: string } => {
  if (!config.isDateDependent) {
    return {
      cachePath: `socketDataCache/allDates`,
      trackerDateKey: ALL_DATES_KEY,
    };
  }
  return {
    cachePath: `socketDataCache/${source}/${dateWanted}`,
    trackerDateKey: dateWanted,
  };
};

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
}): Promise<FetchResponse<unknown> | null> => {
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

  let dataResponse: FetchResponse<unknown>;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    // call the actual fetch function and get the data, race this against a timeout promise to avoid hanging
    const timeoutPromise = new Promise<FetchResponse<unknown>>((_, reject) => {
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
}): Promise<FetchResponse<unknown> | null> => {
  const dataType = dataFetchConfig.type;

  // Check if this data type is valid for this source and date (e.g., mtxvideo not valid for dates > 7 days ago)
  if (!isDataTypeValidForSourceAndDate(source, dataType, dateWanted)) {
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

  const { cachePath, trackerDateKey } = getCacheAndTrackerKeys(dataFetchConfig, source, dateWanted);
  const cacheEntry = await getCacheEntry({ folder: cachePath, identifier: dataFetchConfig.type });

  ensureFetchTrackerEntry(source, trackerDateKey, dataType);

  if (cacheEntry?.metadata?.expiration) {
    updateFetchTracker(source, trackerDateKey, dataType, {
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
  const status = ensureFetchTrackerEntry(source, trackerDateKey, dataType);
  const isAlreadyFetching = status.isFetching && status.fetchStartedAt;

  // Determine if we need to fetch
  const needsFetch = isExpired || !hasCachedData;

  // Start background fetch if needed and not already fetching
  if (needsFetch && !isAlreadyFetching && autoRefresh) {
    ConsoleLogger.debug(
      `${dataFetchConfig.type} Starting background fetch for ${source}_${trackerDateKey} (expired: ${isExpired}, hasCache: ${hasCachedData})`
    );

    // Fire and forget - don't await
    performBackgroundFetch({
      source,
      dateWanted,
      dataFetchConfig,
      autoRefresh,
    }).catch((error) => {
      ConsoleLogger.error(
        `${dataFetchConfig.type} Error in background fetch for ${source}_${trackerDateKey}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    });
  } else if (isAlreadyFetching) {
    ConsoleLogger.debug(
      `${dataFetchConfig.type} Already fetching for ${source}_${trackerDateKey}, skipping duplicate fetch`
    );
  }

  // If cache is NOT expired and autoRefresh is enabled, ensure new timeout is scheduled
  if (!isExpired && hasCachedData && autoRefresh) {
    const status = globalValues.fetchTrackers?.[source]?.[trackerDateKey]?.[dataFetchConfig.type];
    if (!status?.timeoutObject) {
      const delay = calculateTimeoutDelayFromExpiration(cacheEntry.metadata.expiration);
      if (delay > 0) {
        createTimeoutObject({
          source,
          dateWanted: trackerDateKey,
          dataType: dataFetchConfig.type,
          timeoutCallback: async () => {
            ConsoleLogger.debug(
              `${dataFetchConfig.type} Timeout triggered refresh for ${source}_${trackerDateKey}`
            );
            await performBackgroundFetch({
              source,
              dateWanted,
              dataFetchConfig,
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
      `${dataFetchConfig.type} Returning cached data for ${source}_${trackerDateKey} (expired: ${isExpired})`
    );
    updateFetchTracker(source, trackerDateKey, dataType, {
      lastCacheHitAt: new Date().toISOString(),
      lastOperationSuccess:
        (cacheEntry.data as FetchResponse<unknown>)?.fetchMetadata?.success ?? true,
    });
    return cacheEntry.data as FetchResponse<unknown>;
  }

  // No cache available
  ConsoleLogger.debug(`${dataFetchConfig.type} No cache for ${source}_${trackerDateKey}`);
  updateFetchTracker(source, trackerDateKey, dataType, {
    lastCacheMissAt: new Date().toISOString(),
  });
  return null;
};

/**
 * Reads the cache bookkeeping for a data type without fetching or scheduling anything.
 * Useful for endpoints that need to report when data was cached and when it expires.
 * Returns null when the type does not use the cache or has no entry yet.
 */
export const getCacheStatusForDataType = async ({
  source,
  dateWanted,
  dataFetchConfig,
}: {
  source: Source;
  dateWanted: string;
  dataFetchConfig: FetchConfig;
}): Promise<{ cachedAt: string; expiration: string } | null> => {
  if (!dataFetchConfig.enableCacheUse) return null;

  const { cachePath } = getCacheAndTrackerKeys(dataFetchConfig, source, dateWanted);
  const cacheEntry = await getCacheEntry({ folder: cachePath, identifier: dataFetchConfig.type });
  if (!cacheEntry) return null;

  return {
    cachedAt: cacheEntry.createdAt.toISOString(),
    expiration: cacheEntry.metadata?.expiration ?? "",
  };
};

/**
 * Performs a background fetch, updates cache, emits to clients, and schedules next refresh
 */
const performBackgroundFetch = async ({
  source,
  dateWanted,
  dataFetchConfig,
  autoRefresh,
}: {
  source: Source;
  dateWanted: string;
  dataFetchConfig: FetchConfig;
  autoRefresh: boolean;
}): Promise<void> => {
  const dataType = dataFetchConfig.type;
  const isDateDependent = dataFetchConfig.isDateDependent ?? true;
  const { cachePath, trackerDateKey } = getCacheAndTrackerKeys(dataFetchConfig, source, dateWanted);

  // Get current cache for comparison later
  const currentCacheEntry = await getCacheEntry({ folder: cachePath, identifier: dataType });

  // Fetch new data
  const dataResponse = await fetchData({
    source,
    dateWanted,
    config: dataFetchConfig,
  });

  if (!dataResponse?.fetchMetadata?.success) {
    ConsoleLogger.warn(
      `${dataFetchConfig.type} Error getting data for ${trackerDateKey}. Message: ${dataResponse?.fetchMetadata?.error}`
    );
  }

  // Calculate next expiration time
  // For non-date-dependent data, always use the "today" refresh interval since data applies to all dates
  let baseRefreshInterval: number | null;
  if (!isDateDependent) {
    baseRefreshInterval = dataFetchConfig.refreshIntervalTodayMs;
  } else {
    const today = new Date().toISOString().split("T")[0];
    const isToday = dateWanted === today;
    baseRefreshInterval = isToday
      ? dataFetchConfig.refreshIntervalTodayMs
      : dataFetchConfig.refreshIntervalMs;
  }

  // If refresh interval is null, no automatic refreshing should occur
  const shouldScheduleRefresh = baseRefreshInterval !== null && autoRefresh;

  let expirationISO: string | undefined;
  if (shouldScheduleRefresh && baseRefreshInterval !== null) {
    const randomFactor = 0.8 + Math.random() * 0.4; // ±20% randomness
    const randomizedInterval = Math.floor(baseRefreshInterval * randomFactor);
    expirationISO = new Date(Date.now() + randomizedInterval).toISOString();
  }

  // Update cache with new data
  await putCacheEntry({
    folder: cachePath,
    identifier: dataType,
    data: (dataResponse?.fetchMetadata?.success ? dataResponse : currentCacheEntry?.data) as
      | object
      | null,
    metadata: {
      expiration:
        dataResponse?.fetchMetadata?.success && expirationISO
          ? expirationISO
          : (currentCacheEntry?.metadata?.expiration ?? ""),
    },
  });

  // Schedule next refresh if refresh interval is configured and autoRefresh is enabled
  if (shouldScheduleRefresh && expirationISO) {
    const delay = calculateTimeoutDelayFromExpiration(expirationISO);
    if (delay > 0) {
      createTimeoutObject({
        source,
        dateWanted: trackerDateKey,
        dataType: dataFetchConfig.type,
        timeoutCallback: async () => {
          ConsoleLogger.debug(
            `${dataFetchConfig.type} Timeout triggered refresh for ${source}_${trackerDateKey}`
          );
          await performBackgroundFetch({
            source,
            dateWanted,
            dataFetchConfig,
            autoRefresh,
          });
        },
        delay,
      });
    }
  } else if (baseRefreshInterval === null) {
    ConsoleLogger.debug(
      `${dataFetchConfig.type} No automatic refresh scheduled for ${source}_${trackerDateKey} (refreshInterval is null)`
    );
  }

  // Emit to all clients only if data changed and response is valid
  const previousData = (currentCacheEntry?.data as FetchResponse<unknown>)?.data;
  if (!isEqual(dataResponse?.data, previousData)) {
    // For non-date-dependent data, emit to all rooms for this source
    if (!isDateDependent && dataResponse) {
      ConsoleLogger.debug(
        `${dataFetchConfig.type} Emitting data update to all rooms for source ${source}`
      );
      emitDataUpdateToSource({
        source,
        dataUpdate: { type: dataFetchConfig.type, response: dataResponse },
      });
    } else if (dataResponse) {
      ConsoleLogger.debug(
        `${dataFetchConfig.type} Emitting data update to room for ${source}_${trackerDateKey}`
      );
      emitDataUpdate({
        source,
        dataDate: trackerDateKey,
        dataUpdate: { type: dataFetchConfig.type, response: dataResponse },
      });
    }
    updateFetchTracker(source, trackerDateKey, dataType, {
      lastEmitAt: new Date().toISOString(),
    });
  } else if (!dataResponse) {
    ConsoleLogger.debug(
      `${dataFetchConfig.type} No data response for ${source}_${dateWanted}, skipping emit`
    );
  } else {
    ConsoleLogger.debug(
      `${dataFetchConfig.type} Data unchanged for ${source}_${trackerDateKey}, skipping emit`
    );
    updateFetchTracker(source, trackerDateKey, dataType, {
      lastEmitSkippedAt: new Date().toISOString(),
    });
  }
};

/**
 * Force refresh a specific data type by expiring the cache and triggering a normal fetch
 */
export const forceRefreshDataType = async ({
  source,
  dateWanted,
  dataType,
}: {
  source: Source;
  dateWanted: string;
  dataType: StoreDataType;
}): Promise<{ success: boolean; data?: FetchResponse<unknown>; error?: string }> => {
  try {
    // Check if this data type is valid for this source and date
    if (!isDataTypeValidForSourceAndDate(source, dataType, dateWanted)) {
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

    // If this data type doesn't use cache, just fetch and return
    if (!config.enableCacheUse) {
      ConsoleLogger.debug(
        `${dataType} Force refresh for ${source}_${dateWanted} (data does not use cache)`
      );
      const dataResponse = await getSourceDateDataType({
        source,
        dateWanted,
        dataFetchConfig: config,
        autoRefresh: false,
      });
      return { success: true, data: dataResponse ?? undefined };
    }

    ConsoleLogger.debug(
      `${dataType} Force refresh requested for ${source}_${dateWanted}. Expiring cache and clearing timeout...`
    );

    const { cachePath, trackerDateKey } = getCacheAndTrackerKeys(config, source, dateWanted);

    // Clear any existing timeout
    clearTrackerDataTimeout(source, trackerDateKey, dataType);

    // Expire the cache entry by setting expiration to the past (preserves data in case fetch fails)
    const currentCacheEntry = await getCacheEntry({ folder: cachePath, identifier: dataType });
    const expiredTimestamp = new Date(Date.now() - 10000).toISOString(); // 10 seconds in the past
    if (currentCacheEntry) {
      const metadata: CacheMetadata = {
        expiration: expiredTimestamp, // Set to past to guarantee expiration
      };
      await putCacheEntry({
        folder: cachePath,
        identifier: dataType,
        data: currentCacheEntry.data as object | null,
        metadata,
      });
      ConsoleLogger.debug(`${dataType} Expired cache entry for ${source}_${trackerDateKey}`);
    } else {
      ConsoleLogger.debug(
        `${dataType} No cache entry found for ${source}_${trackerDateKey}, will force fetch`
      );
    }

    // Update status to indicate cache was expired
    updateFetchTracker(source, trackerDateKey, dataType, {
      cacheExpiration: expiredTimestamp,
    });

    // Force fetch new data (with autoRefresh enabled to restart the timeout)
    const dataResponse = await getSourceDateDataType({
      source,
      dateWanted,
      dataFetchConfig: config,
    });

    ConsoleLogger.debug(
      `${dataType} Force refresh completed for ${source}_${dateWanted}. Success: ${dataResponse?.fetchMetadata?.success}`
    );

    return { success: true, data: dataResponse ?? undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error during force refresh";
    ConsoleLogger.error(`${dataType} Error during force refresh: ${message}`);
    return { success: false, error: message };
  }
};
