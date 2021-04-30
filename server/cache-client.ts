import crypto from "crypto";
import { promises as fs } from "fs";
import isNull from "lodash/isNull";
import { diff } from "store/playhead";

/**
 * Get data from the cache when it exists and is less than `process.env.CACHE_AGE` old. Otherwise, hit the network and add to the cache
 * @param service Name of the service requesting data
 * @param identifier Identifies this specific request
 * @param retriever Async function to perform a request if we can't use the cache. Must return JSON
 * @param cache Default to 5 mins
 * @param staleOk Whether or not returning stale data is acceptable when the `retriever` fails
 * @returns
 */
export default async function cacheJSON<T>(
  service: string,
  identifier: string,
  retriever: () => Promise<T>,
  cacheAge = 300,
  staleOk = false
): Promise<T> {
  // to be clear, we're not hashing sensitive data, just filenames
  const hash = crypto.createHash("md5");
  hash.update(service + identifier);

  const cacheFile = `${process.env.CACHE_ROOT}/${hash.copy().digest("hex")}.json`;

  let res = null as T;
  let cachedRes = null as string;

  let f = null;
  let dataIsStillFresh = false;

  try {
    f = await fs.stat(cacheFile);
  } catch (e) {
    // couldn't find the cache file, no problem
  }

  try {
    if (!isNull(f) && f.isFile()) {
      // get the cached data now, decide if we want to use it later
      cachedRes = await fs.readFile(cacheFile, { encoding: "utf-8" });
      res = JSON.parse(cachedRes);
      dataIsStillFresh = diff(new Date(), new Date(f.mtimeMs)) / 1000 < cacheAge;
    }
  } catch (e) {
    // we couldn't read or parse the cache file, no problem
  }

  if (dataIsStillFresh) {
    // the cache is hot! return cached data
    return res;
  }

  try {
    // either the cache file doesn't exist, the cache file can't be parsed as JSON, the cache file is too old, or we couldn't read the cache file altogether. now we need to fetch new data
    res = await retriever();
  } catch (e) {
    if (!isNull(res) && staleOk) {
      // even though this request failed, we still have good stale data in the cache and the caller is fine with that
      console.error(`Stale data is being returned for '${service}' and '${identifier}'`);
      return res;
    }

    // let the caller decide what to do with this unhandled error
    throw e;
  }

  // cache the results for later
  try {
    // make sure the cache directory exists first
    await fs.mkdir(process.env.CACHE_ROOT, { recursive: true });
    // write to the cache
    await fs.writeFile(cacheFile, JSON.stringify(res));
  } catch (e) {
    console.error(`Could not cache new data to: '${cacheFile}'`);
    console.error(e);
  }

  return res;
}
