import getVideoData from "server/processing/media/videos";
import { globalValues } from "./global";
import { emitDataUpdate } from "./sockets";
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
import cacache from "cacache";
import { ConsoleLogger } from "../../utils/logger";
import isEqual from "lodash/isEqual";

type SocketCacheMetadata = {
  expiration: string;
  retrieving: boolean;
};

export const dataFetchConfigs: DataFetchConfig[] = [
  {
    type: "daynight",
    getDataFunction: getDayNight,
  },
  {
    type: "ephemeris",
    getDataFunction: getEphemera,
  },
  {
    type: "videos",
    getDataFunction: getVideoData,
  },
  {
    type: "photos",
    getDataFunction: getPhotoData,
  },
  {
    type: "wikiEvas",
    getDataFunction: getISSEvaData,
  },
  {
    type: "wikiTestEvents",
    getDataFunction: getTestEventsData,
  },
  {
    type: "mtxvideo",
    getDataFunction: fetchMTXAPIResponses,
  },
  {
    type: "gpstracks",
    getDataFunction: getGpsTrackData,
  },
  {
    type: "transcript",
    getDataFunction: getTranscripts,
  },
  {
    type: "sgaudio",
    getDataFunction: getLabsSgAudio,
  },
  {
    type: "graph",
    getDataFunction: getGraphManifest,
  },
];

const setDataRefreshTimeout = ({
  source,
  dateWanted,
  dataType,
  timeoutCallback,
  delay,
}: {
  source: Source;
  dateWanted: string;
  dataType: string;
  timeoutCallback: () => void;
  delay: number;
}) => {
  // Initialize nested objects if they don't exist
  if (!globalValues.serverDataRefreshTimeouts[source]) {
    globalValues.serverDataRefreshTimeouts[source] = {};
  }
  if (!globalValues.serverDataRefreshTimeouts[source][dateWanted]) {
    globalValues.serverDataRefreshTimeouts[source][dateWanted] = {};
  }

  // Clear existing timeout if it exists
  globalValues.serverDataRefreshTimeouts?.[source]?.[dateWanted]?.[dataType] &&
    clearTimeout(globalValues.serverDataRefreshTimeouts[source][dateWanted][dataType]);

  ConsoleLogger.log(
    `${dataType} Setting timeout for ${source}_${dateWanted} with delay ${delay / 1000}s`
  );
  globalValues.serverDataRefreshTimeouts[source][dateWanted][dataType] = setTimeout(
    timeoutCallback,
    delay
  );
};

const calculateTimeoutFromExpiration = (expiration: string, bufferMs: number = 1000): number => {
  // Maximum timeout of 24 hours (86400000 ms)
  // Prevents potential integer overflow issues in Node.js setTimeout
  const MAX_TIMEOUT = 86400000;

  // If expiration is null, return 60 seconds +- 5 seconds
  if (!expiration) return 60000 + Math.floor(Math.random() * 10000) - 5000;

  const expirationTime = new Date(expiration).getTime();
  const timeUntilExpiration = expirationTime - Date.now();

  // If the expiration time is in the past, return 60 seconds +- 5 seconds
  if (timeUntilExpiration <= 0) return 60000 + Math.floor(Math.random() * 10000) - 5000;

  if (timeUntilExpiration > MAX_TIMEOUT) {
    ConsoleLogger.log(
      `Reducing timeout from ${timeUntilExpiration / 1000}s to ${MAX_TIMEOUT / 1000}s to avoid overflow`
    );
    return MAX_TIMEOUT;
  }
  return timeUntilExpiration + bufferMs;
};

// Helper function for fetch and retry logic
const fetchDataWithRetries = async ({
  config,
  dateWanted,
  source,
}: {
  config: DataFetchConfig;
  dateWanted: string;
  source: Source;
}): Promise<WrappedResponse<any>> => {
  if (dateWanted === undefined || source === undefined) {
    ConsoleLogger.error(`No dateWanted or source provided for ${config.type} fetchDataWithRetries`);
    return null;
  }

  let wrappedResponse = await config.getDataFunction({
    dateWanted,
    forceNew: false,
    source: source ? source : undefined,
  });
  // if an error occurred, don't retry
  if (wrappedResponse?.responseMetadata?.retrieverStatus === "error") {
    return wrappedResponse;
  }
  let tries = 0;
  while (wrappedResponse?.responseMetadata?.retrieverStatus === "inprogress" && tries < 7) {
    // Total maximum wait time: ~16.75 seconds (including initial request),
    const baseDelay = 1000; // 1 second base
    const maxDelay = 3000; // cap individual delays at 3 seconds
    const delayTime = Math.min(baseDelay * Math.pow(1.5, tries), maxDelay);
    ConsoleLogger.warn(
      `${config.type} ${wrappedResponse?.responseMetadata?.retrieverStatus} Gradual backoff: Attempt ${tries + 1} on ${dateWanted}, waiting ${delayTime}ms.`
    );
    await new Promise((resolve) => setTimeout(resolve, delayTime));
    tries++;
    wrappedResponse = await config.getDataFunction({
      dateWanted,
      forceNew: false,
      source: source ? source : undefined,
    });
    // if an error occurred during retry, exit immediately
    if (wrappedResponse?.responseMetadata?.retrieverStatus === "error") {
      ConsoleLogger.error(
        `Received error status during gradual backoff for ${config.type} on ${dateWanted}.`
      );
      break;
    }
  }
  return wrappedResponse;
};

const getCacheEntry = async ({ cachePath, dataType }: { cachePath: string; dataType: string }) => {
  try {
    return await cacache.get(cachePath, dataType);
  } catch (e) {
    return null;
  }
};

const updateSocketCache = async ({
  cachePath,
  dataType,
  data,
  metadata,
}: {
  cachePath: string;
  dataType: string;
  data: string;
  metadata: SocketCacheMetadata;
}) => {
  await cacache.put(cachePath, dataType, data, { metadata });
};

export const getSourceDateDataType = async ({
  source,
  dateWanted,
  dataFetchConfig,
  autoRefresh = true, // autoRefresh would be false when called from a non-socket client like a legacy API endpoint
}: {
  source: Source;
  dateWanted: string;
  dataFetchConfig: DataFetchConfig;
  autoRefresh?: boolean;
}): Promise<WrappedResponse<any>> => {
  const cachePath = `${process.env.CACHE_ROOT}/socketDataCache/${source}/${dateWanted}`;
  const cacheEntry = await getCacheEntry({ cachePath, dataType: dataFetchConfig.type });

  // Check if data is currently being fetched
  if (cacheEntry?.metadata?.retrieving) {
    const socketCacheExpired = cacheEntry?.metadata?.expiration
      ? Date.now() > new Date(cacheEntry.metadata.expiration).getTime()
      : true;

    if (!socketCacheExpired) {
      ConsoleLogger.log(
        `${dataFetchConfig.type} Data is already being fetched for ${source}_${dateWanted}, return the existing cache data.`
      );
      const cacheEntryData =
        cacheEntry?.data?.toString() === "" ? null : JSON.parse(cacheEntry?.data?.toString());
      return cacheEntryData;
    }
  }

  // Check if we need to fetch new data
  const isExpired = cacheEntry?.metadata?.expiration
    ? Date.now() > new Date(cacheEntry.metadata.expiration).getTime()
    : true;

  // Return cached data if not expired
  if (cacheEntry && !isExpired) {
    // Setup timeout if missing
    if (!globalValues.serverDataRefreshTimeouts?.[source]?.[dateWanted]?.[dataFetchConfig.type]) {
      const delay = calculateTimeoutFromExpiration(cacheEntry.metadata.expiration);
      if (delay > 0) {
        setDataRefreshTimeout({
          source,
          dateWanted,
          dataType: dataFetchConfig.type,
          timeoutCallback: async () => {
            ConsoleLogger.log(
              `${dataFetchConfig.type} Timeout is refreshing data for ${source}_${dateWanted}`
            );
            await getSourceDateDataType({
              source,
              dateWanted,
              dataFetchConfig,
            });
          },
          delay,
        });
      }
    }

    try {
      return JSON.parse(cacheEntry?.data?.toString());
    } catch (e) {
      ConsoleLogger.error(
        "Failed to parse cached data JSON. Erasing cache entry and continuing to fetch new data"
      );
      // Clear cache entry if parsing fails
      await cacache.rm.entry(cachePath, dataFetchConfig.type);
      // Continue to fetch new data
    }
  }

  ConsoleLogger.log(`${dataFetchConfig.type} Cache miss or expired for ${source}_${dateWanted}`);

  // Mark as retrieving to prevent multiple fetches with an expiration to account for stuck fetches
  await updateSocketCache({
    cachePath,
    dataType: dataFetchConfig.type,
    data: cacheEntry ? cacheEntry.data.toString() : "",
    metadata: {
      expiration: new Date(Date.now() + 30000).toISOString(),
      retrieving: true,
    },
  });

  // Fetch new data
  const wrappedResponse = await fetchDataWithRetries({
    source,
    dateWanted,
    config: dataFetchConfig,
  });

  if (wrappedResponse?.responseMetadata?.retrieverStatus !== "complete") {
    ConsoleLogger.error(
      `${dataFetchConfig.type} Error getting data for ${dateWanted}. retrieverStatus: ${wrappedResponse?.responseMetadata?.retrieverStatus}. Continuing.`
    );
  }

  if (autoRefresh) {
    // Setup refresh timeout
    const delay = calculateTimeoutFromExpiration(wrappedResponse?.responseMetadata?.expiration);
    if (delay > 0) {
      setDataRefreshTimeout({
        source,
        dateWanted,
        dataType: dataFetchConfig.type,
        timeoutCallback: async () => {
          ConsoleLogger.log(
            `${dataFetchConfig.type} Timeout is refreshing data for ${source}_${dateWanted}`
          );
          await getSourceDateDataType({
            source,
            dateWanted,
            dataFetchConfig,
          });
        },
        delay,
      });
    }
  }

  let cacheEntryData: WrappedResponse<any> = {
    data: null,
    responseMetadata: {
      retrieverStatus: "error",
      expiration: null,
      cachedTimestamp: null,
      error: null,
      retrieverErrorCount: 0,
      lastErrorTimestamp: null,
    },
  };
  try {
    cacheEntryData =
      cacheEntry?.data?.toString() === "" ? null : JSON.parse(cacheEntry?.data?.toString());
  } catch (e) {
    ConsoleLogger.error("Failed to parse cached data JSON. Assuming null");
  }

  // Emit to all clients in source_date channel regardless of status, but only if the data from the fetch is different from the cache
  if (!isEqual(wrappedResponse?.data, cacheEntryData?.data)) {
    ConsoleLogger.log(
      `${dataFetchConfig.type} Emitting data update to room for ${source}_${dateWanted} to all clients\n`
    );

    emitDataUpdate({
      source,
      dataDate: dateWanted,
      dataUpdate: { type: dataFetchConfig.type, wrappedResponse },
    });
  } else {
    ConsoleLogger.log(
      `${dataFetchConfig.type} NOT emitting data update to room for ${source}_${dateWanted} because the data is the same as the cache\n`
    );
  }

  // Update cache with new data even if it's an error
  await updateSocketCache({
    cachePath,
    dataType: dataFetchConfig.type,
    data: JSON.stringify(wrappedResponse),
    metadata: {
      expiration: wrappedResponse?.responseMetadata?.expiration,
      retrieving: false,
    },
  });

  // return the fetched data. This will be emitted to a client from the socket join if that's where this function was called from
  return wrappedResponse;
};
