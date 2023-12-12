import cacache from "cacache";
import crypto from "crypto";
import isNull from "lodash/isNull";
import _ from "lodash";
import { CacheFolder } from "utils/enums";

interface FetchWithCacheParams<T> {
  /** The cache key. Must be unique for the folder */
  identifier: string;
  /** Name of the subdirectory in the cacheRoot for this data */
  cacheFolder: CacheFolder;
  /** Async function to perform a request if we can't use the cache. Must return JSON */
  retriever: () => Promise<T>;
  /** The max age for cache entries before retrieving new data. When the retriever is run, this value is used to create the expiration value store in the caCache metadata. Note that a random amount of time is added to this value to avoid cache stampedes */
  cacheAge?: number;
  /**Return the cached data, then force the retriever function to get new data regardless of cache age. */
  forceRetriever?: boolean;
  /** An optional boolean that determines whether or not to randomize the cache age. This is useful for testing. */
  randomizeCacheAge?: boolean;
  /** The number of milliseconds to grow the cooldown between retries for errors. The retriever will only be allowed to run `min(30000, errorRetryCoefficient * errorCount)` ms after an error */
  errorRetryCoefficient?: number;
}

/**
 * Get data from the cache when it exists and is less than `process.env.CACHE_AGE` old. Otherwise, hit the network and add to the cache
 * Note that the cache only supports caching of json responses
 */
export default async function fetchWithCache<T>(
  params: FetchWithCacheParams<T>,
): Promise<WrappedResponse<T>> {
  const {
    identifier,
    cacheFolder,
    retriever,
    cacheAge = 60 * 60 * 24, // 1 day
    forceRetriever = false,
    randomizeCacheAge = true,
    errorRetryCoefficient = 10000,
  } = params;
  const cachePath = `${process.env.CACHE_ROOT}/${cacheFolder}`;

  // to be clear, we're not hashing sensitive data, just cache keys
  const hash = crypto.createHash("md5");
  hash.update(identifier);
  const cacheKey = hash.copy().digest("hex");

  let cachedData: Buffer = Buffer.from('{"empty": "cache"}'); // default to this value because we can't put null in caCache data
  let cachedRes: T = null;

  // make a new expiry date that is cacheAge seconds from now but add a random number of seconds to avoid cache stampedes
  const newExpiration = randomizeCacheAge
    ? new Date(Date.now() + cacheAge * 1000 + _.random(0, 100000)) // 100 seconds
    : new Date(Date.now() + cacheAge * 1000);

  const cacheInfo = (await cacache.get.info(cachePath, cacheKey)) || null;

  // if there is a cache entry for this key
  if (!isNull(cacheInfo)) {
    const cacheEntry = await cacache.get(cachePath, cacheKey);
    const caCacheMetadata: CaCacheMetadata = cacheEntry?.metadata;
    cachedData = cacheEntry.data;
    cachedRes = JSON.parse(cachedData.toString());

    let currentRetrieverStatus: RetrieverStatus = caCacheMetadata?.retrieverStatus;

    // All the cases where we want to run the retriever function
    if (forceRetriever) {
      // manually force a new retriever
      handleRetriever(cachedData, caCacheMetadata, retriever, newExpiration);
      currentRetrieverStatus = "inprogress";
    } else if (
      new Date(caCacheMetadata?.expiration) < new Date() &&
      caCacheMetadata?.retrieverStatus === "complete"
    ) {
      // if the cache is expired and the retriever is not already running, then run the retriever
      handleRetriever(cachedData, caCacheMetadata, retriever, newExpiration);
      currentRetrieverStatus = "inprogress";
    } else if (caCacheMetadata?.retrieverStatus === "error") {
      // if the retriever has errored, space out retries by `errorRetryCoefficient` ms each time, with a max wait of 30 seconds
      const retryInterval = Math.min(30000, errorRetryCoefficient * caCacheMetadata.errorCount);
      const lastRetryTimestamp = new Date(caCacheMetadata.lastErrorTimestamp);
      const nextRetryTimestamp = new Date(lastRetryTimestamp.getTime() + retryInterval);

      if (nextRetryTimestamp < new Date()) {
        currentRetrieverStatus = "inprogress";
        handleRetriever(cachedData, caCacheMetadata, retriever, newExpiration);
      }
    }

    // return the cached data and the cached status.
    const responseMetadata: ResponseMetadata = {
      cachedTimestamp: caCacheMetadata?.cachedTimestamp,
      expiration: caCacheMetadata.expiration,
      retrieverStatus: currentRetrieverStatus,
      error: caCacheMetadata.retrieverErrorDescription,
      errorCount: caCacheMetadata.errorCount,
      lastErrorTimestamp: caCacheMetadata.lastErrorTimestamp,
    };
    return {
      responseMetadata,
      data: !cachedRes.hasOwnProperty("empty") ? cachedRes : null,
    };
  } else {
    // no record of this cache key
    // cache an inprogress response so the next request knows retreiver has been kicked off
    const caCacheMetadata: CaCacheMetadata = {
      retrieverStatus: "inprogress",
      cachedTimestamp: null,
      expiration: null,
      retrieverErrorDescription: null,
      errorCount: 0,
      lastErrorTimestamp: null,
    };
    // run the retriever function to get fresh data but don't wait for it
    handleRetriever(cachedData, caCacheMetadata, retriever, newExpiration);

    // return inprogress status with null data
    const responseMetadata: ResponseMetadata = {
      retrieverStatus: "inprogress",
      cachedTimestamp: null,
      expiration: null,
      error: null,
      errorCount: 0,
      lastErrorTimestamp: null,
    };
    return { responseMetadata, data: null };
  }

  /**
   * This function will be called when the retriever function is run.
   * It will update the cache with the retrieved data and a new retrieverStatus of "complete" and the expiration date for the cached data\
   * @param cachedData The data Buffer that was originally cached
   * @param caCacheMetadata The metadata object that was originally cached
   * @param retriever The async function that will retrieve the data
   * @param expiration The expiration date for the cached data
   */
  async function handleRetriever(
    cachedData: Buffer,
    caCacheMetadata: CaCacheMetadata,
    retriever: () => Promise<any>,
    expiration: Date,
  ) {
    // set the cache status to "inprogress" so other requests will know to try again later
    await cacache.put(cachePath, cacheKey, cachedData, {
      metadata: { ...caCacheMetadata, retrieverStatus: "inprogress" },
    });

    // run the retriever function and cache the result
    retriever()
      .then(async (res) => {
        // cache the data retrieved by the retriever function and set the cache metadata
        const caCacheMetadata: CaCacheMetadata = {
          retrieverStatus: "complete",
          cachedTimestamp: new Date().toISOString(),
          expiration: expiration.toISOString(),
          retrieverErrorDescription: null,
          errorCount: 0,
          lastErrorTimestamp: null,
        };

        // update the cache with the retrieved data and a new status of "complete" and the expiration date for the cached data
        await cacache.put(cachePath, cacheKey, Buffer.from(JSON.stringify(res)), {
          metadata: caCacheMetadata,
        });
      })
      .catch((e) => {
        console.warn(`Error in retriever for '${cacheFolder}/${identifier}'`);
        // update the cache preserving any originally cached data and expiration, and set a new retrieverStatus and include the error
        // increment the retry count and set the lastRetryTimestamp
        caCacheMetadata.retrieverStatus = "error";
        caCacheMetadata.errorCount += 1;
        caCacheMetadata.lastErrorTimestamp = new Date().toISOString();
        cacache.put(cachePath, cacheKey, cachedData, {
          metadata: { ...caCacheMetadata, retrieverErrorDescription: e.toString() },
        });
      });
  }
}

/** Nuke the cache */
export async function clearAll() {
  try {
    for (const folder in CacheFolder) {
      const cachePath = `${process.env.CACHE_ROOT}/${CacheFolder[folder]}`;
      await cacache.rm.all(cachePath);
    }
  } catch (e) {
    console.warn(`Could not clear cache`);
    console.warn(e);
  }
}

export async function clearCacheByIdentifer(identifier: string, folder: CacheFolder) {
  const cachePath = `${process.env.CACHE_ROOT}/${folder}`;
  const hash = crypto.createHash("md5");
  hash.update(identifier);
  const cacheKey = hash.copy().digest("hex");
  try {
    await cacache.rm(cachePath, cacheKey);
  } catch (e) {
    console.warn(`Could not clear cache identifier: '${folder}/${identifier}'`);
    console.warn(e);
  }
}

export async function clearCacheByFolder(folder: CacheFolder) {
  const cachePath = `${process.env.CACHE_ROOT}/${folder}`;
  try {
    await cacache.rm.all(cachePath);
  } catch (e) {
    console.warn(`Could not clear cache folder: '${folder}'`);
    console.warn(e);
  }
}
