import cacache from "cacache";
import crypto from "crypto";
import isNull from "lodash/isNull";
import { diff } from "store/playhead";
import { WrappedResponse } from "typings";

// IO uses a NOCA cert. We need to tell Node to use system certs on Mac and Windows. Node on Linux uses system certs by default. see the discussion/complaints here https://github.com/nodejs/node/issues/3159#issuecomment-477295118
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
  /** Default false. Instead of throwing errors, act like the `retriever` succeeded and return an `error` property in the response */
  errorOk?: boolean;
}

const defaultOptions: Options = {
  cacheAge: 300,
  staleOk: false,
  preferNew: false,
  errorOk: false,
};

/**
 * Get data from the cache when it exists and is less than `process.env.CACHE_AGE` old. Otherwise, hit the network and add to the cache
 * @param service Name of the service requesting data
 * @param identifier Identifies this specific request
 * @param retriever Async function to perform a request if we can't use the cache. Must return JSON
 */
export default async function retrieveJSON<T>(
  identifier: string,
  retriever: () => Promise<T>,
  options?: Options
): Promise<WrappedResponse<T>> {
  const opts = { ...defaultOptions, ...options };

  // to be clear, we're not hashing sensitive data, just filenames
  const hash = crypto.createHash("md5");
  hash.update(identifier);
  const cacheKey = hash.copy().digest("hex");

  let res = null as T;
  let cachedRes = null as string;

  let cacheIsHot = false;
  let cacheRead = false;

  const cacheInfo = await cacache.get.info(process.env.CACHE_ROOT, cacheKey);

  try {
    if (!isNull(cacheInfo)) {
      // get the cached data now, decide if we want to use it later
      const cacheEntry = await cacache.get(process.env.CACHE_ROOT, cacheKey);
      cachedRes = cacheEntry.data.toString();
      res = JSON.parse(cachedRes);

      cacheIsHot = diff(new Date(), new Date(cacheInfo.time)) / 1000 < opts.cacheAge;
      cacheRead = true;
    }
  } catch (e) {
    // something went wrong reading or parsing the cache, no problem
    console.warn(e);
  }

  if (cacheIsHot && !opts.preferNew) {
    // nothing else to do! give the caller the data
    return { cacheRead, data: res };
  }

  try {
    res = await retriever();
  } catch (e) {
    if (!isNull(res) && (opts.staleOk || opts.preferNew)) {
      // even though this request failed, we still have good stale data in the cache and the caller is fine with that
      console.warn(`Stale data is being returned for '${identifier}'`);
      return { data: res, cacheRead: true };
    }

    if (opts.errorOk) {
      // the caller is fine with an error response
      return { error: e.toString() };
    } else {
      // let the caller decide what to do with this unhandled error
      throw e;
    }
  }

  let cacheWrite = false;

  // cache the results for later
  try {
    // write to the cache
    await cacache.put(process.env.CACHE_ROOT, cacheKey, Buffer.from(JSON.stringify(res)));
    cacheWrite = true;
  } catch (e) {
    console.warn(`Could not cache: '${identifier}'`);
    console.warn(e);
  }

  return { cacheRead, cacheWrite, data: res };
}

/** Nuke the cache */
export async function clear() {
  await cacache.rm.all(process.env.CACHE_ROOT);
}
