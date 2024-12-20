import cacache from "cacache";
import crypto from "crypto";
import isNil from "lodash/isNil";
import random from "lodash/random";

interface FetchWithCacheParams<T> {
  /** The cache key. Must be unique for the folder */
  identifier: string;
  /** Name of the subdirectory in the cacheRoot for this data */
  cacheFolder: CacheFolder;
  /** Async function to perform a request if we can't use the cache. Must return JSON */
  retriever: () => Promise<T>;
  /** The max age in seconds for cache entries before retrieving new data. When the retriever is run,
   * this value is used to create the expiration value store in the caCache metadata.
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

Case (2) is assumed to be caused by an issue with the cache. While cacache is robust, lots can go wrong when you read from / write to the filesystem.
This is especially so because we are not guaranteed to have exclusive control over the disk that the cache lives on.
We could have everything from permission issues to missing disks to corrupted files to missing volumes, etc.
We take the view that errors could occur on reads from the cache or writes to the cache. Thus, in the function below we only `try / catch` the
  first time we read from / write to the cache. Subsequent reads and writes are assumed to be safe if the first ones worked.

The cache client is supposed to be a transparent layer from the perspective of the caller.
We are always responsible for returning data (when we can). You will see that if we cannot access the cache,
  we still run the retriever function to give something to the caller.
CODA will slow down because we're skipping the cache, but at least it should keep working!
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
  const cachePath = `${process.env.CACHE_ROOT}/${cacheFolder}`;

  // to be clear, we're not hashing sensitive data, just cache keys
  const hash = crypto.createHash("md5");
  hash.update(identifier);
  const cacheKey = hash.copy().digest("hex");

  const noCacheRunRetriever = async () => {
    const newResponseMetadata: ResponseMetadata = {
      retrieverStatus: null,
      cachedTimestamp: null,
      expiration: null,
      error: "cache client failed",
      retrieverErrorCount: 0,
      lastErrorTimestamp: new Date().toISOString(),
    };

    try {
      const res = await retriever();
      newResponseMetadata.retrieverStatus = "complete";
      return {
        responseMetadata: newResponseMetadata,
        data: res,
      };
    } catch (e) {
      newResponseMetadata.retrieverStatus = "error";
      newResponseMetadata.error = `cache client failed and retriever also failed with ${e}`;
      return {
        responseMetadata: newResponseMetadata,
        data: null,
      };
    }
  };

  // default cachedData to this Buffer because we can't put null in caCache data
  let cachedData: Buffer = Buffer.from('{"empty": "cache"}');
  let cachedRes: T = null;
  let shouldRunRetriever: Boolean;
  let caCacheMetadata: CaCacheMetadata = {
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
  let cacheInfo = null;

  try {
    // probe the cache
    cacheInfo = await cacache.get.info(cachePath, cacheKey);
  } catch (e) {
    console.error(`Cache client failed to read from cache path ${cachePath}`, e);
    return noCacheRunRetriever();
  }

  if (isNil(cacheInfo)) {
    // new cache entry! always run the retriever in this case
    shouldRunRetriever = true;
  } else {
    // we have a cache entry! grab what we know about the retriever and response from last time
    //   and then determine if we have to run the retriever or not
    const cacheEntry = await cacache.get(cachePath, cacheKey);
    cachedData = cacheEntry.data;
    cachedRes = JSON.parse(cachedData.toString());
    caCacheMetadata = cacheEntry.metadata;
    responseMetadata = {
      ...responseMetadata,
      retrieverStatus: caCacheMetadata.retrieverStatus,
      cachedTimestamp: caCacheMetadata.cachedTimestamp,
      expiration: caCacheMetadata.expiration,
      retrieverErrorCount: caCacheMetadata.retrieverErrorCount,
    };

    shouldRunRetriever =
      // caller is insistent, or...
      forceRetriever ||
      // ...cache is expired like normal, or...
      (caCacheMetadata?.retrieverStatus === "complete" &&
        new Date(caCacheMetadata?.expiration) < new Date()) ||
      // ...something went wrong with the retriever last time (and we've waited long enough to try again)
      (caCacheMetadata?.retrieverStatus === "error" &&
        waitedLongEnough(caCacheMetadata, errorRetryCoefficient)) ||
      // ...the retriever is still in progress but it has been taking longer than the caCacheMetadata.expiration that we set when we started it, so retry
      (caCacheMetadata?.retrieverStatus === "inprogress" &&
        new Date(caCacheMetadata?.expiration) < new Date());
  }

  if (shouldRunRetriever) {
    responseMetadata.retrieverStatus = "inprogress";
    caCacheMetadata.retrieverStatus = "inprogress";
    // use caCacheMetadata.expiration to store the expiration date that in this case means how long to wait for "inprogress" before trying again
    caCacheMetadata.expiration = new Date(Date.now() + 60000).toISOString(); // 60 seconds
    try {
      await cacache.put(cachePath, cacheKey, cachedData, {
        metadata: caCacheMetadata,
      });
    } catch (e) {
      console.error(`cache client failed to write to cache path ${cachePath}`, e);
      return noCacheRunRetriever();
    }
    retriever()
      .then(async (res) => {
        //update the cache
        const newData = Buffer.from(JSON.stringify(res));

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

        const newMetadata: CaCacheMetadata = {
          retrieverStatus: "complete",
          cachedTimestamp: new Date().toISOString(),
          expiration: expiration.toISOString(),
          retrieverErrorDescription: null,
          retrieverErrorCount: 0,
          lastErrorTimestamp: null,
        };

        return cacache.put(cachePath, cacheKey, newData, {
          metadata: newMetadata,
        });
      })
      .catch((e) => {
        // the cache should represent that an error occurred in the retriever

        const newMetadata: CaCacheMetadata = {
          retrieverStatus: "error",
          cachedTimestamp: caCacheMetadata.cachedTimestamp,
          expiration: caCacheMetadata.expiration,
          retrieverErrorDescription: e.toString(),
          retrieverErrorCount: caCacheMetadata.retrieverErrorCount + 1,
          lastErrorTimestamp: new Date().toISOString(),
        };

        return cacache.put(cachePath, cacheKey, cachedData, {
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
function waitedLongEnough(caCacheMetadata: CaCacheMetadata, errorRetryCoefficient: number) {
  // if the retriever has errored, space out retries by an additional `errorRetryCoefficient` ms each time, with a max wait of 30 seconds
  const retryInterval = Math.min(
    30000,
    errorRetryCoefficient * 1000 * caCacheMetadata.retrieverErrorCount
  );
  const lastRetryTimestamp = new Date(caCacheMetadata.lastErrorTimestamp);
  const nextRetryTimestamp = new Date(lastRetryTimestamp.getTime() + retryInterval);
  const now = new Date();

  return now > nextRetryTimestamp;
}

/** Nuke the cache */
export async function clearAll() {
  const cacheFolder = {
    Celestrak: "celestrak" as CacheFolder,
    Spacetrack: "spacetrack" as CacheFolder,
    Daynight_topo: "daynight/topo" as CacheFolder,
    Daynight_issLocation: "daynight/issLocation" as CacheFolder,
    Io: "io" as CacheFolder,
    Transcripts: "labs/transcripts" as CacheFolder,
    Audio: "labs/audio" as CacheFolder,
    Wiki: "wiki" as CacheFolder,
    Wiki_all: "wiki/all" as CacheFolder,
    Wiki_gps: "wiki/gps" as CacheFolder,
    test: "test" as CacheFolder,
  };

  try {
    for (const folder in cacheFolder) {
      const cachePath = `${process.env.CACHE_ROOT}/${cacheFolder[folder as keyof typeof cacheFolder]}`;
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
