import cacache from "cacache";
import crypto from "crypto";
import isNull from "lodash/isNull";
import { diff } from "store/playhead";
import { ResMetadata, WrappedResponse } from "typings";

// NASA APIs use NOCA certs. We need to tell Node to use system certs on Mac and Windows. Node on Linux uses system certs by default. see the discussion/complaints here https://github.com/nodejs/node/issues/3159#issuecomment-477295118
require("mac-ca");
require("win-ca");

/** Caching options for managing how JSON is retrieved and stored */
interface Options {
  /** Default 5 mins (300s). Unless `staleOk` is true, this is the max age allowed for cache entries before retrieving new data. Setting `{ cacheAge: 0, staleOk: true }` always runs the `retriever` and treats the cache like a fallback (or you could simply set `{ preferNew: true }`) */
  cacheAge?: number;
  /** Default false. Whether or not returning stale data is acceptable when the `retriever` fails */
  staleOk?: boolean;
  /** Default false. Always retrieve new data. Only return cached data if the `retriever` fails */
  preferNew?: boolean;
}

const defaultOptions: Options = {
  cacheAge: +process.env.DEFAULT_CACHE_AGE,
  staleOk: false,
  preferNew: false,
};

/**
 * Get data from the cache when it exists and is less than `process.env.CACHE_AGE` old. Otherwise, hit the network and add to the cache
 * @param identifier The cache key
 * @param retriever Async function to perform a request if we can't use the cache. Must return JSON
 * @param options Cache behavior options
 */
export default async function retrieveJSON<T>(
  identifier: string,
  retriever: () => Promise<T>,
  options?: Options
): Promise<WrappedResponse<T>> {
  const opts = { ...defaultOptions, ...options };

  opts.preferNew = process.env.DISABLE_CACHE === "true" ? true : opts.preferNew;

  // to be clear, we're not hashing sensitive data, just cache keys
  const hash = crypto.createHash("md5");
  hash.update(identifier);
  const cacheKey = hash.copy().digest("hex");

  let res = null as T;
  let cachedRes = null as T;
  let cachedData = null as string;

  let metadata = {
    fromCache: false,
    cacheTimestamp: null,
    stale: false,
  } as ResMetadata;

  let cacheIsHot = false;

  const cacheInfo = await cacache.get.info(process.env.CACHE_ROOT, cacheKey);

  try {
    if (!isNull(cacheInfo)) {
      // get the cached data now, decide if we want to use it later
      const cacheEntry = await cacache.get(process.env.CACHE_ROOT, cacheKey);
      cachedData = cacheEntry.data.toString();
      cachedRes = JSON.parse(cachedData);

      cacheIsHot = diff(new Date(), new Date(cacheInfo.time)) / 1000 < opts.cacheAge;
      metadata = {
        fromCache: true,
        cacheTimestamp: new Date(cacheInfo.time),
        stale: !cacheIsHot,
      };
    }
  } catch (e) {
    // something went wrong reading or parsing the cache, no problem
    console.warn(e);
  }

  if (cacheIsHot && !opts.preferNew) {
    // nothing else to do! give the caller the cached data
    return { metadata, data: cachedRes };
  }

  try {
    res = await retriever();
  } catch (e) {
    if (!isNull(cachedRes) && (opts.staleOk || opts.preferNew)) {
      // even though this request failed, we still have good stale data in the cache and the caller is fine with that
      console.warn(`Stale data is being returned for '${identifier}'`);
      console.warn(e);
      metadata.fromCache = false;
      metadata.cacheTimestamp = null;
      metadata.stale = true;
      return { metadata, data: cachedRes };
    } else {
      // the caller is fine with an error response
      metadata.error = e.toString();
      return { metadata };
    }
  }

  // the retriever has returned fresh data
  metadata.fromCache = false;
  metadata.cacheTimestamp = null;
  metadata.stale = false;

  // cache the fresh data for later
  try {
    // write to the cache
    await cacache.put(process.env.CACHE_ROOT, cacheKey, Buffer.from(JSON.stringify(res)));
  } catch (e) {
    console.warn(`Could not cache: '${identifier}'`);
    console.warn(e);
  }

  return { metadata, data: res };
}

/** Nuke the cache */
export async function clear() {
  await cacache.rm.all(process.env.CACHE_ROOT);
}
