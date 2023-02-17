import cacache from "cacache";
import crypto from "crypto";
import isNull from "lodash/isNull";
import { diff } from "store/playhead";
import _ from "lodash";
import { CacheFolder } from "utils/enums";

/** Caching options for managing how JSON is retrieved and stored */
interface CacheOptions {
  /** Default 5 mins (300s). This is the max age allowed for cache entries before retrieving new data. */
  cacheAge?: number;
  /** Default true. Whether or not returning expired data (data thats older than cacheAge) is acceptable when the `retriever` fails */
  expiredCacheOkIfFetchFails?: boolean;
  /** Default false. Whether or not to retrieve new data first before checking the cache. Only return cached data if the `retriever` fails */
  tryFetchNewFirst?: boolean;
}

const defaultOptions: CacheOptions = {
  cacheAge: +process.env.DEFAULT_CACHE_AGE,
  expiredCacheOkIfFetchFails: true,
  tryFetchNewFirst: false,
};

/**
 * Get data from the cache when it exists and is less than `process.env.CACHE_AGE` old. Otherwise, hit the network and add to the cache
 * @param uniqueIdentifier The cache key. Must be unique for the folder
 * @param retriever Async function to perform a request if we can't use the cache. Must return JSON
 * @param cacheFolder name of the subdirectory in the cacheRoot for this data
 * @param options Cache behavior options
 * @param responseValidator Test function returning bool if the retriever response is valid and should be cached. Default will always cache. This can be used to prevent empty responses being cached
 */
export default async function fetchWithCache<T>(
  uniqueIdentifier: string,
  cacheFolder: CacheFolder,
  retriever: () => Promise<T>,
  options?: CacheOptions,
  responseValidator?: (data: T) => boolean
): Promise<WrappedResponse<T>> {
  const opts = { ...defaultOptions, ...options };
  if (!responseValidator) {
    responseValidator = () => {
      return true;
    };
  }
  const cachePath = `${process.env.CACHE_ROOT}/${cacheFolder}`;

  opts.tryFetchNewFirst = process.env.DISABLE_CACHE === "true" ? true : opts.tryFetchNewFirst;

  // to be clear, we're not hashing sensitive data, just cache keys
  const hash = crypto.createHash("md5");
  hash.update(uniqueIdentifier);
  const cacheKey = hash.copy().digest("hex");

  let res = null as T;
  let cachedRes = null as T;
  let cachedData = null as string;

  let cacheMetadata = {
    fromCache: false,
    timestamp: null,
    expiration: null,
  } as CacheMetadata;

  let cacheIsHot = false; //if cache is not expired (has not hit cacheAge yet)

  const cacheInfo = await cacache.get.info(cachePath, cacheKey);

  try {
    if (!isNull(cacheInfo)) {
      // get the cached data now, decide if we want to use it later
      const cacheEntry = await cacache.get(cachePath, cacheKey);
      cachedData = cacheEntry.data.toString();
      cachedRes = JSON.parse(cachedData);

      cacheIsHot = diff(new Date(), new Date(cacheInfo.time)) / 1000 < opts.cacheAge;
      cacheMetadata = {
        fromCache: true,
        timestamp: new Date(cacheInfo.time),
        expiration: new Date(new Date(cacheInfo.time).getTime() + opts.cacheAge * 1000),
      };
    }
  } catch (e) {
    // something went wrong reading or parsing the cache, no problem
    console.warn(e);
  }

  // cache is within cacheAge and caller does not want to try to retrieve a new copy
  if (cacheIsHot && !opts.tryFetchNewFirst) {
    return { cacheMetadata, data: cachedRes };
  }

  //cache is empty or expired, or caller wants to try to retrieve a new copy
  try {
    res = await retriever();
  } catch (e) {
    //Retriever failed
    if (!isNull(cachedRes) && opts.expiredCacheOkIfFetchFails) {
      // we have expired data in the cache and the caller is ok with expired data
      console.warn(`Expired data is being returned for '${uniqueIdentifier}'`);
      console.warn(e);
      return { cacheMetadata, data: cachedRes };
    } else {
      cacheMetadata.error = e.toString();
      cacheMetadata.fromCache = false;
      cacheMetadata.timestamp = null;
      cacheMetadata.expiration = null;
      return { cacheMetadata };
    }
  }

  //the retriever returned fresh data. Validate to determine if we should cache it
  if (!responseValidator(res)) {
    // data is not valid. Attempt to return expired data or error
    if (!isNull(cachedRes) && opts.expiredCacheOkIfFetchFails) {
      console.warn(
        `Retriever returned invalid data. Expired data is being returned for '${uniqueIdentifier}'`
      );
      return { cacheMetadata, data: cachedRes };
    } else {
      cacheMetadata.error = "Retriever returned invalid data. No data available to return";
      cacheMetadata.fromCache = false;
      cacheMetadata.timestamp = null;
      return { cacheMetadata };
    }
  }

  cacheMetadata.fromCache = false;
  cacheMetadata.timestamp = null;
  cacheMetadata.expiration = null;

  // cache the fresh data for later
  try {
    await cacache.put(cachePath, cacheKey, Buffer.from(JSON.stringify(res)));
  } catch (e) {
    console.warn(`Could not cache: '${uniqueIdentifier}'`);
    console.warn(e);
  }

  return { cacheMetadata, data: res };
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
    if (!folder) throw new Error("invalid folder");
    await cacache.rm(cachePath, cacheKey);
  } catch (e) {
    console.warn(`Could not clear cache identifier: '${folder}/${identifier}'`);
    console.warn(e);
  }
}

export async function clearCacheByFolder(folder: CacheFolder) {
  const cachePath = `${process.env.CACHE_ROOT}/${folder}`;
  try {
    if (!folder) throw new Error("invalid folder");
    await cacache.rm.all(cachePath);
  } catch (e) {
    console.warn(`Could not clear cache folder: '${folder}'`);
    console.warn(e);
  }
}
