import getVideoData from "server/processing/media/videos";
import { globalValues } from "./global";
import { emitDataUpdate, emitFetchInspectorUpdate } from "./sockets";
import getDayNight from "server/processing/daynight/daynight";
import getEphemera from "server/processing/location/iss";
import getPhotoData from "server/processing/media/photos";
import getGpsTrackData from "server/processing/db/gps";
import { fetchMTXAPIResponses } from "server/services/emss";
import getTranscripts from "server/processing/emss/transcript";
import getLabsSgAudio from "server/processing/emss/sgAudio";
import getGraphManifest from "server/processing/sequences/graph";
import { getISSEvaData } from "server/processing/sequences/evas";
import getTestEventsData from "server/processing/sequences/test-events";
import { ConsoleLogger } from "../../utils/logger";
import isEqual from "lodash/isEqual";
import { getCacheEntry, putCacheEntry } from "server/processing/cache-db";
import { isDataTypeValidForSource } from "utils/sourceDataTypeMap";

export const dataFetchConfigs: FetchConfig[] = [
  {
    type: "daynight",
    getDataFunction: getDayNight,
    refreshIntervalTodayMs: 3 * 60 * 60 * 1000, // 3 hours for today's data
    refreshIntervalMs: 12 * 60 * 60 * 1000, // 12 hours for other days
  },
  {
    type: "ephemeris",
    getDataFunction: getEphemera,
    refreshIntervalTodayMs: 3 * 60 * 60 * 1000, // 3 hours for today's data
    refreshIntervalMs: 12 * 60 * 60 * 1000, // 12 hours for other days
  },
  {
    type: "videos",
    getDataFunction: getVideoData,
    refreshIntervalTodayMs: 2 * 60 * 1000, // 2 minutes for today's data
    refreshIntervalMs: 15 * 60 * 1000, // 15 minutes for other days
  },
  {
    type: "photos",
    getDataFunction: getPhotoData,
    refreshIntervalTodayMs: 2 * 60 * 1000, // 2 minutes for today's data
    refreshIntervalMs: 15 * 60 * 1000, // 15 minutes for other days
  },
  {
    type: "wikiEvas",
    getDataFunction: getISSEvaData,
    disableCacheUse: true, // Static data from JSON file, (data does not use cache)
  },
  {
    type: "wikiTestEvents",
    getDataFunction: getTestEventsData,
    disableCacheUse: true, // Static data from JSON file, (data does not use cache)
  },
  {
    type: "mtxvideo",
    getDataFunction: fetchMTXAPIResponses,
    timeoutMs: 20000,
    refreshIntervalTodayMs: 2 * 60 * 1000, // 2 minutes for today's data
    refreshIntervalMs: 60 * 60 * 1000, // 60 minutes for other days
  },
  {
    type: "gpstracks",
    getDataFunction: getGpsTrackData,
    refreshIntervalTodayMs: 12 * 60 * 60 * 1000, // 12 hours for today's data
    refreshIntervalMs: 12 * 60 * 60 * 1000, // 12 hours for other days
  },
  {
    type: "transcript",
    getDataFunction: getTranscripts,
    refreshIntervalTodayMs: 2 * 60 * 1000, // 2 minutes for today's data
    refreshIntervalMs: 3 * 60 * 60 * 1000, // 3 hours for other days
  },
  {
    type: "sgaudio",
    getDataFunction: getLabsSgAudio,
    refreshIntervalTodayMs: 2 * 60 * 1000, // 2 minutes for today's data
    refreshIntervalMs: 3 * 60 * 60 * 1000, // 3 hours for other days
  },
  {
    type: "graph",
    getDataFunction: getGraphManifest,
    refreshIntervalTodayMs: 12 * 60 * 60 * 1000, // 12 hours for today's data
    refreshIntervalMs: 12 * 60 * 60 * 1000, // 12 hours for other days
  },
];

const DEFAULT_DATA_FETCH_TIMEOUT_MS = 30000; // 30 seconds
const DATA_REFRESH_INTERVAL_MS = 15 * 60 * 1000; // refresh cache every 15 minutes by default
const DATA_REFRESH_INTERVAL_MS_TODAY = 2 * 60 * 1000; // refresh cache every 2 minutes for "today" data types

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
    ConsoleLogger.log(`${dataType} Cleared existing timeout for ${source}_${dateWanted}`);
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

  ConsoleLogger.log(
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
  // Maximum timeout of 24 hours (86400000 ms)
  // Prevents potential integer overflow issues in Node.js setTimeout
  const maxTimeout = 86400000;

  // If expiration is null, return 60 seconds +- 5 seconds
  if (!expiration) return 60000 + Math.floor(Math.random() * 10000) - 5000;

  const expirationTime = new Date(expiration).getTime();
  const timeUntilExpiration = expirationTime - Date.now();

  // If the expiration time is in the past, return 60 seconds +- 5 seconds
  if (timeUntilExpiration <= 0) return 60000 + Math.floor(Math.random() * 10000) - 5000;

  if (timeUntilExpiration > maxTimeout) {
    ConsoleLogger.log(
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
  const fetchTimeoutMs = config.timeoutMs ?? DEFAULT_DATA_FETCH_TIMEOUT_MS;
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
        () => reject(new Error(`Timeout after ${fetchTimeoutMs}ms`)),
        fetchTimeoutMs
      );
    });

    dataResponse = await Promise.race([
      config.getDataFunction({
        dateWanted,
        source,
        timeoutMs: fetchTimeoutMs,
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
    lastFetchStartedAt: fetchStartedAt.toISOString(),
    lastFetchCompletedAt: fetchCompletedAt.toISOString(),
    lastFetchDurationMs: durationMs,
    lastResultWasSuccess: succeeded,
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

  // If disableCacheUse is true, fetch data directly without using cache
  if (dataFetchConfig.disableCacheUse) {
    ConsoleLogger.log(
      `${dataType} Skipping cache for ${source}_${dateWanted} (disableCacheUse enabled)`
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
    ConsoleLogger.log(
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
    ConsoleLogger.log(
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
            ConsoleLogger.log(
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
    ConsoleLogger.log(
      `${dataFetchConfig.type} Returning cached data for ${source}_${dateWanted} (expired: ${isExpired})`
    );
    updateFetchTracker(source, dateWanted, dataType, {
      lastCacheHitAt: new Date().toISOString(),
      lastResultWasSuccess: (cacheEntry.data as any)?.metadata?.success ?? true,
    });
    return cacheEntry.data as FetchResponse<any>;
  }

  // No cache available
  ConsoleLogger.log(`${dataFetchConfig.type} No cache for ${source}_${dateWanted}`);
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
    ? (dataFetchConfig.refreshIntervalTodayMs ?? DATA_REFRESH_INTERVAL_MS_TODAY)
    : (dataFetchConfig.refreshIntervalMs ?? DATA_REFRESH_INTERVAL_MS);

  const randomFactor = 0.8 + Math.random() * 0.4; // ±20% randomness
  const randomizedInterval = Math.floor(baseRefreshInterval * randomFactor);
  const expirationISO = new Date(Date.now() + randomizedInterval).toISOString();

  // Update cache with new data
  await putCacheEntry({
    folder: cachePath,
    identifier: dataType,
    data: dataResponse?.fetchMetadata?.success ? dataResponse : currentCacheEntry?.data,
    metadata: {
      expiration: dataResponse?.fetchMetadata?.success
        ? expirationISO
        : currentCacheEntry?.metadata?.expiration,
    },
  });

  // Schedule next refresh if autoRefresh is enabled
  if (autoRefresh) {
    const delay = calculateTimeoutDelayFromExpiration(expirationISO);
    if (delay > 0) {
      createTimeoutObject({
        source,
        dateWanted,
        dataType: dataFetchConfig.type,
        timeoutCallback: async () => {
          ConsoleLogger.log(
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

  // Emit to all clients only if data changed
  const previousData = (currentCacheEntry?.data as FetchResponse<any>)?.data;
  if (!isEqual(dataResponse?.data, previousData)) {
    ConsoleLogger.log(
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
    ConsoleLogger.log(
      `${dataFetchConfig.type} Data unchanged for ${source}_${dateWanted}, skipping emit`
    );
    updateFetchTracker(source, dateWanted, dataType, {
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
}): Promise<{ success: boolean; data?: FetchResponse<any>; error?: string }> => {
  try {
    // Check if this data type is valid for this source
    if (!isDataTypeValidForSource(source, dataType)) {
      const errorMsg = `Data type ${dataType} is not available for source ${source}`;
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
    if (config.disableCacheUse) {
      ConsoleLogger.log(
        `${dataType} Force refresh for ${source}_${dateWanted} (data does not use cache)`
      );
      const dataResponse = await getSourceDateDataType({
        source,
        dateWanted,
        dataFetchConfig: config,
        autoRefresh: false,
      });
      return { success: true, data: dataResponse };
    }

    ConsoleLogger.log(
      `${dataType} Force refresh requested for ${source}_${dateWanted}. Expiring cache and clearing timeout...`
    );

    // Clear any existing timeout
    clearTrackerDataTimeout(source, dateWanted, dataType);

    // Expire the cache entry by setting expiration to the past (preserves data in case fetch fails)
    const cachePath = `socketDataCache/${source}/${dateWanted}`;
    const currentCacheEntry = await getCacheEntry({ folder: cachePath, identifier: dataType });
    const expiredTimestamp = new Date(Date.now() - 10000).toISOString(); // 10 seconds in the past
    if (currentCacheEntry) {
      const metadata: CacheMetadata = {
        expiration: expiredTimestamp, // Set to past to guarantee expiration
      };
      await putCacheEntry({
        folder: cachePath,
        identifier: dataType,
        data: currentCacheEntry.data,
        metadata,
      });
      ConsoleLogger.log(`${dataType} Expired cache entry for ${source}_${dateWanted}`);
    } else {
      ConsoleLogger.log(
        `${dataType} No cache entry found for ${source}_${dateWanted}, will force fetch`
      );
    }

    // Update status to indicate cache was expired
    updateFetchTracker(source, dateWanted, dataType, {
      cacheExpiration: expiredTimestamp,
    });

    // Force fetch new data (with autoRefresh enabled to restart the timeout)
    const dataResponse = await getSourceDateDataType({
      source,
      dateWanted,
      dataFetchConfig: config,
    });

    ConsoleLogger.log(
      `${dataType} Force refresh completed for ${source}_${dateWanted}. Success: ${dataResponse?.fetchMetadata?.success}`
    );

    return { success: true, data: dataResponse };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error during force refresh";
    ConsoleLogger.error(`${dataType} Error during force refresh: ${message}`);
    return { success: false, error: message };
  }
};
