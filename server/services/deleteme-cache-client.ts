import cacache from "cacache";
import crypto from "crypto";
import isNull from "lodash/isNull";
import _ from "lodash";
import { CacheFolder } from "utils/enums";

interface FetchWithCacheParams<T> {
  identifier: string; // The cache key. Must be unique for the folder
  cacheFolder: CacheFolder; // Name of the subdirectory in the cacheRoot for this data
  retriever: () => Promise<T>; // Async function to perform a request if we can't use the cache. Must return JSON
  cacheAge?: number; // The max age for cache entries before retrieving new data. When the retriever is run, this value is used to create the expiration value store in the caCache metadata. Note that a random amount of time is added to this value to avoid cache stampedes
  forceRetriever?: boolean; // Return the cached data, then force the retriever function to get new data regardless of cache age.
  randomizeCacheAge?: boolean; // An optional boolean that determines whether or not to randomize the cache age. This is useful for testing.
}

/**
 * Get data from the cache when it exists and is less than `process.env.CACHE_AGE` old. Otherwise, hit the network and add to the cache
 * Note that the cache only supports caching of json responses
 */
export default async function fetchWithCache<T>(
  params: FetchWithCacheParams<T>,
  handleRetriever = goRetrieve,
): Promise<WrappedResponse<T>> {
  const {
    identifier,
    cacheFolder,
    retriever,
    cacheAge = 60 * 60 * 24, // 1 day
    forceRetriever = false,
    randomizeCacheAge = true,
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

    let retrieverStatus = caCacheMetadata?.retrieverStatus;

    // All the cases where we want to run the retriever function
    if (forceRetriever) {
      handleRetriever<T>(
        cachePath,
        cacheKey,
        identifier,
        cachedData,
        caCacheMetadata,
        retriever,
        newExpiration,
      );
    } else if (!retrieverStatus) {
      // if there is no retriever status, then the cache is from an old version of CODA and we need to run the retriever
      handleRetriever<T>(
        cachePath,
        cacheKey,
        identifier,
        cachedData,
        caCacheMetadata,
        retriever,
        newExpiration,
      );
    } else if (
      new Date(caCacheMetadata?.expiration) < new Date() &&
      retrieverStatus !== "inprogress"
    ) {
      // if the cache is expired and the retriever is not already running, then run the retriever
      handleRetriever<T>(
        cachePath,
        cacheKey,
        identifier,
        cachedData,
        caCacheMetadata,
        retriever,
        newExpiration,
      );
    } else if (retrieverStatus === "error") {
      // if the retriever has errored use the retryCount and lastRetryTimestamp to determine if we should run the retriever again. Retries should be spaces out gradually based on the retryCount and lastRetryTimestamp starting at immediate and slowing to every 30 seconds
      const retryInterval =
        caCacheMetadata.errorCount <= 3 ? 10000 * caCacheMetadata.errorCount : 30000; // max 30 seconds
      const lastRetryTimestamp = new Date(caCacheMetadata.lastErrorTimestamp);
      const nextRetryTimestamp = new Date(lastRetryTimestamp.getTime() + retryInterval);

      if (nextRetryTimestamp < new Date()) {
        handleRetriever<T>(
          cachePath,
          cacheKey,
          identifier,
          cachedData,
          caCacheMetadata,
          retriever,
          newExpiration,
        );
      }
    }

    // return the cached data and the cached status.
    const responseMetadata: ResponseMetadata = {
      cachedTimestamp: caCacheMetadata?.cachedTimestamp,
      expiration: caCacheMetadata.expiration,
      retrieverStatus,
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
    const caCacheMetadata: CaCacheMetadata = {
      retrieverStatus: "inprogress",
      cachedTimestamp: null,
      expiration: null,
      retrieverErrorDescription: null,
      errorCount: 0,
      lastErrorTimestamp: null,
    };
    // run the retriever function to get fresh data but don't wait for it
    handleRetriever<T>(
      cachePath,
      cacheKey,
      identifier,
      cachedData,
      caCacheMetadata,
      retriever,
      newExpiration,
    );

    // return null data and the inprogress status
    const responseMetadata: ResponseMetadata = {
      cachedTimestamp: null,
      expiration: null,
      retrieverStatus: "inprogress",
      error: null,
      errorCount: 0,
      lastErrorTimestamp: null,
    };
    return { responseMetadata, data: null };
  }
}

/**
 * This function will be called when the retriever function is run.
 * It will update the cache with the retrieved data and a new retrieverStatus of "complete" and the expiration date for the cached data\
 * @param cachedData The data Buffer that was originally cached
 * @param caCacheMetadata The metadata object that was originally cached
 * @param retriever The async function that will retrieve the data
 * @param expiration The expiration date for the cached data
 */
export async function goRetrieve<T>(
  cachePath: string,
  cacheKey: string,
  identifier: string,
  cachedData: Buffer,
  caCacheMetadata: CaCacheMetadata,
  retriever: () => Promise<T>,
  expiration: Date,
) {
  // TODO move this up. combine calls to `handleRetriever`
  // set the cache status to "inprogress" so other requests will know to try again later
  await cacache.put(cachePath, cacheKey, cachedData, {
    metadata: { ...caCacheMetadata, retrieverStatus: "inprogress" },
  });

  // run the retriever function and cache the result
  let res: T;
  let newMetadata: CaCacheMetadata = caCacheMetadata;
  let newCachedData: Buffer = cachedData;
  try {
    res = await retriever();
    newCachedData = Buffer.from(JSON.stringify(res));
    newMetadata = {
      retrieverStatus: "complete",
      cachedTimestamp: new Date().toISOString(),
      expiration: expiration.toISOString(),
      retrieverErrorDescription: null,
      errorCount: 0,
      lastErrorTimestamp: null,
    };
  } catch (e) {
    console.warn(`Error in retriever for '${cachePath}/${identifier}'`);

    // update the cache preserving any originally cached data and expiration, and set a new retrieverStatus of "complete" and include the error
    // increment the retry count and set the lastRetryTimestamp
    newMetadata.retrieverStatus = "error";
    newMetadata.errorCount += 1;
    newMetadata.lastErrorTimestamp = new Date().toISOString();
  }

  // write the new data and metadata
  await cacache.put(cachePath, cacheKey, newCachedData, {
    metadata: newMetadata,
  });
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
