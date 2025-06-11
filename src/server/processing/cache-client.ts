import random from "lodash/random";
import { getCacheEntry, putCacheEntry } from "./cache-db";

interface FetchWithCacheParams<T> {
  /** The cache key. Must be unique for the folder */
  identifier: string;
  /** Name of the subdirectory in the cacheRoot for this data */
  cacheFolder: CacheFolder;
  /** Async function to perform a request if we can't use the cache. Must return JSON */
  retriever: () => Promise<T>;
  /** The max age in seconds for cache entries before retrieving new data. When the retriever is run,
   * this value is used to create the expiration value store in the cache metadata.
   * Note that a random amount of time is added to this value to avoid cache stampedes */
  cacheAge?: number;
  /**Return the cached data, then force the retriever function to get new data regardless of cache age. */
  forceRetriever?: boolean;
  /** An optional boolean that determines whether or not to randomize the cache age. This is useful for testing. */
  randomizeCacheAge?: boolean;
  /** The number of seconds to grow the cooldown between retries for errors. The retriever will only be allowed
   * to run `min(30, errorRetryCoefficient * errorCount)` seconds after an error */
  errorRetryCoefficient?: number;
}

/*
Caching strategy at a high level:

Initial request - initiate the long-running request (which we call the `retriever` function) in a non-blocking fashion and
  immediately let the caller know  the data is "inprogress"
Later requests
  - If the cache has not expired, return the requested data and do nothing else
  - If the cache has expired, return the stale requested data and run another retriever in a non-blocking fashion
  - If a retriever is "inprogress", return null or what's in the cache and do not run the retriever again.

Expiration dates are relative to when the retriever it is *completed*, not when it is initiated. For instance, if call is
  made at t = 0 with a 10 second expiration and a retriever that completes at t = 5, the cache will expire at time t = 15.

Notes about error handling:
There are two types of errors to consider - (1) errors that are the fault of the retriever and (2) errors that are the fault of the cache.

In the case of (1), we use the `"error"` retriever status to let the caller know something went wrong with their retriever.
We enforce that the caller must wait some growing number of seconds, with a maximum of 30 seconds, between retriever calls that err.

Case (2) involves issues with the database cache. Errors can occur during reads (`getCacheEntry`) or writes (`putCacheEntry`)
due to various reasons like connection problems, query failures, or other database-related issues.
We aim to make the cache layer transparent and resilient. If cache operations fail, we log the error
and attempt to proceed by running the `retriever` function. This ensures that CODA continues to function,
albeit potentially slower if the cache is consistently unavailable, rather than failing outright due to cache issues.
The primary goal is to return data to the caller whenever possible.
*/

/**
 * Get data from the cache when it exists and is less than `process.env.CACHE_AGE` old. Otherwise, hit the network and add to the cache
 * Note that the cache only supports caching of json responses
 */
export default async function fetchWithCache<T>({
  identifier,
  cacheFolder,
  retriever,
  cacheAge = 60 * 60 * 24, // 1 day
  forceRetriever = false,
  randomizeCacheAge = true,
  errorRetryCoefficient = 10, // 10 seconds
}: FetchWithCacheParams<T>): Promise<WrappedResponse<T>> {
  const cachePath = `${cacheFolder}`;

  const cacheKey = identifier; // Use the identifier directly as the cache key

  let cachedRes: T = null;
  const initialCacheObject = { empty: "cache" }; // Used as a placeholder or default
  let shouldRunRetriever: Boolean;
  let cacheMetadata: CacheMetadata = {
    retrieverStatus: null,
    cachedTimestamp: null,
    expiration: null,
    retrieverErrorDescription: null,
    retrieverErrorCount: 0,
    lastErrorTimestamp: null,
  };
  let responseMetadata: ResponseMetadata = {
    retrieverStatus: null,
    cachedTimestamp: null,
    expiration: null,
    error: null,
    retrieverErrorCount: 0,
    lastErrorTimestamp: null,
  };

  // fetch the cache entry
  let cacheEntry;
  try {
    cacheEntry = await getCacheEntry({ folder: cachePath, identifier: cacheKey });
  } catch (e) {
    console.warn(
      `Cache client failed to read from cache. Key: ${cacheKey}. Proceeding with retriever.`,
      e
    );
    // Treat as cache miss, retriever will run.
    cacheEntry = null;
  }

  if (cacheEntry) {
    cachedRes = cacheEntry.data as T;
    cacheMetadata = cacheEntry.metadata as CacheMetadata; // Ensure metadata is correctly typed
    responseMetadata = {
      ...responseMetadata,
      retrieverStatus: cacheMetadata.retrieverStatus,
      cachedTimestamp: cacheMetadata.cachedTimestamp,
      expiration: cacheMetadata.expiration,
      retrieverErrorCount: cacheMetadata.retrieverErrorCount,
    };

    shouldRunRetriever =
      // caller is insistent, or...
      forceRetriever ||
      // ...cache is expired like normal, or...
      (cacheMetadata?.retrieverStatus === "complete" &&
        new Date(cacheMetadata?.expiration) < new Date()) ||
      // ...something went wrong with the retriever last time (and we've waited long enough to try again)
      (cacheMetadata?.retrieverStatus === "error" &&
        waitedLongEnough(cacheMetadata, errorRetryCoefficient)) ||
      // ...the retriever is still in progress but it has been taking longer than the cacheMetadata.expiration that we set when we started it, so retry
      (cacheMetadata?.retrieverStatus === "inprogress" &&
        new Date(cacheMetadata?.expiration) < new Date());
  } else {
    // no cache entry (or failed to read), so we have to run the retriever
    shouldRunRetriever = true;
  }

  if (shouldRunRetriever) {
    responseMetadata.retrieverStatus = "inprogress";
    cacheMetadata.retrieverStatus = "inprogress";
    // use cacheMetadata.expiration to store the expiration date that in this case means how long to wait for "inprogress" before trying again
    cacheMetadata.expiration = new Date(Date.now() + 60000).toISOString(); // 60 seconds
    try {
      await putCacheEntry({
        folder: cachePath,
        identifier: cacheKey,
        data: cachedRes && !cachedRes.hasOwnProperty("empty") ? cachedRes : initialCacheObject,
        metadata: cacheMetadata,
      });
    } catch (e) {
      console.warn(
        `Cache client failed to write 'inprogress' status to cache. Key: ${cacheKey}. Proceeding with retriever.`,
        e
      );
      // Don't re-throw. Allow retriever to run. The cache might be temporarily unavailable.
    }
    retriever()
      .then(async (res) => {
        //update the cache
        // const newData = JSON.stringify(res); // No longer stringify

        let expiration = new Date(Date.now() + cacheAge * 1000);
        // make a new expiry date that is cacheAge seconds from now but add a random number of seconds to avoid cache stampedes
        if (randomizeCacheAge) {
          if (cacheAge === 0) {
            // live mode randomized cache age. Range is selcted based on client's polling interval in the populate store
            expiration = new Date(Date.now() + random(15000, 45000)); // 15 to 45 seconds
          } else {
            // normal randomized cache age
            expiration = new Date(Date.now() + cacheAge * 1000 + random(0, 100000)); // 100 seconds
          }
        }

        const newMetadata: CacheMetadata = {
          retrieverStatus: "complete",
          cachedTimestamp: new Date().toISOString(),
          expiration: expiration.toISOString(),
          retrieverErrorDescription: null,
          retrieverErrorCount: 0,
          lastErrorTimestamp: null,
        };

        return putCacheEntry({
          folder: cachePath,
          identifier: cacheKey,
          data: res, // Pass the raw 'res' object
          metadata: newMetadata,
        });
      })
      .catch((e) => {
        // the cache should represent that an error occurred in the retriever
        const newMetadata: CacheMetadata = {
          retrieverStatus: "error",
          cachedTimestamp: cacheMetadata.cachedTimestamp,
          expiration: cacheMetadata.expiration,
          retrieverErrorDescription: e.toString(),
          retrieverErrorCount: cacheMetadata.retrieverErrorCount + 1,
          lastErrorTimestamp: new Date().toISOString(),
        };

        return putCacheEntry({
          folder: cachePath,
          identifier: cacheKey,
          data: cachedRes && !cachedRes.hasOwnProperty("empty") ? cachedRes : initialCacheObject,
          metadata: newMetadata,
        });
      });
  }

  return {
    responseMetadata,
    data: !cachedRes?.hasOwnProperty("empty") ? cachedRes : null,
  };
}

/**
 * In the event of an error, we want to avoid spamming retries. Check if enough time has passed since the last retry
 */
function waitedLongEnough(cacheMetadata: CacheMetadata, errorRetryCoefficient: number) {
  // if the retriever has errored, space out retries by an additional `errorRetryCoefficient` ms each time, with a max wait of 30 seconds
  const retryInterval = Math.min(
    30000,
    errorRetryCoefficient * 1000 * cacheMetadata.retrieverErrorCount
  );
  const lastRetryTimestamp = new Date(cacheMetadata.lastErrorTimestamp);
  const nextRetryTimestamp = new Date(lastRetryTimestamp.getTime() + retryInterval);
  const now = new Date();

  return now > nextRetryTimestamp;
}
