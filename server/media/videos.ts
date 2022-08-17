import clone from "lodash/cloneDeep";
import * as IoService from "server/services/io-api";
import * as WikiService from "server/services/wiki-api";
import { Collection, IOFetchType } from "utils/enums";

/**
 * Fetch video data from IO. We can't always trust the accuracy of IO's dates, so we fetch videos from the day before and day after as well
 */
export default async function getVideoData(
  year: number,
  month: number,
  date: number,
  collection: Collection
): Promise<WrappedResponse<VideoFile[]>> {
  const requestedDate = new Date(Date.UTC(year, month - 1, date));

  // fetch video info and fudge factors in parallel
  const [results, overrides] = await Promise.all([
    // fetch and parse videos for the requested day, the day before, and the day after
    IoService.fetchData(collection, IOFetchType.VIDEOS, requestedDate) as Promise<
      WrappedResponse<VideoFile[]>
    >,
    // fetch start time overrides, but don't throw if the request fails
    await (async () => {
      try {
        return await WikiService.fetchDatetimeOverrides();
      } catch (e) {
        // don't block video results if we can't find overrides
        console.error(e);
      }
    })(),
  ]);

  if (!overrides) {
    return results;
  }

  // If we got data (as opposed to an error), we can apply the overrides
  if (results.data) {
    // if we got overrides from the wiki, apply them
    const data: VideoFile[] = results.data.map((result) => {
      const res = clone(result);
      for (let fix of overrides.data.videoFixes) {
        if (fix.videoID === result.id) {
          const duration = res.end - res.start;
          const start = new Date(fix.time).valueOf() / 1000;
          res.start = start;
          res.end = start + duration;
          break;
        }
      }
      return res;
    });

    return {
      ...results,
      data,
    };
  } else {
    return results;
  }
}
