import clone from "lodash/cloneDeep";
import * as IoService from "server/services/io-api";
import * as WikiService from "server/services/wiki-api";
import * as OverrideService from "server/services/media_override";
import { Collection, IOFetchType } from "utils/enums";

/**
 * Fetch video data from IO. We can't always trust the accuracy of IO's dates, so we fetch videos from the day before and day after as well
 */
export default async function getVideoData(
  year: number,
  month: number,
  date: number,
  collection: Collection,
  forceNew: boolean
): Promise<WrappedResponse<VideoFile[]>> {
  const requestedDate = new Date(Date.UTC(year, month - 1, date));

  // Fetch video source overrides from the wiki for this date. If there are none, then use Imagery Online
  try {
    const mediaOverrides = await WikiService.fetchMediaOverrides(forceNew);

    // Check if there is a video override for this date and Source
    const mediaOverride = mediaOverrides?.data?.find((vo) => {
      const overrideDate = new Date(vo.date);
      return (
        overrideDate.getTime() === requestedDate.getTime() &&
        vo.source === collection &&
        vo.type === "video"
      );
    });

    // if there are media overrides, use those instead of IO
    if (mediaOverride) {
      const videos = (await OverrideService.getManifest(mediaOverride)) as VideoFile[];
      return {
        cacheMetadata: {
          fromCache: false,
          timestamp: new Date(),
          expiration: null,
        },
        data: videos,
      } as WrappedResponse<VideoFile[]>;
    }
  } catch (e) {
    // don't block results if media overrides call fails
    console.error(e);
  }

  // fetch video info and fudge factors in parallel
  const [results, timeOverrides] = await Promise.all([
    // fetch and parse videos for the requested day, the day before, and the day after
    IoService.fetchData(collection, IOFetchType.VIDEOS, requestedDate) as Promise<
      WrappedResponse<VideoFile[]>
    >,
    // fetch start time overrides, but don't throw if the request fails
    await (async () => {
      try {
        return await WikiService.fetchDatetimeOverrides(forceNew);
      } catch (e) {
        // don't block video results if we can't find overrides
        console.error(e);
      }
    })(),
  ]);

  if (!timeOverrides) {
    return results;
  }

  // If we got data (as opposed to an error), we can apply the overrides
  if (results.data) {
    // if we got overrides from the wiki, apply them
    const data: VideoFile[] = results.data.map((result) => {
      const res = clone(result);
      for (let fix of timeOverrides.data.videoFixes) {
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
