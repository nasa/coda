import clone from "lodash/cloneDeep";
import * as IoService from "server/services/io-api";
import * as WikiService from "server/services/wiki-api";
import * as OverrideService from "server/services/media_override";
import { collection } from "utils/consts";
import _ from "lodash";

/**
 * Fetch video data from IO. We can't always trust the accuracy of IO's dates, so we fetch videos from the day before and day after as well
 */
export default async function getVideoData(params: {
  dateWanted: string;
  source: Source;
  forceNew: boolean;
}): Promise<WrappedResponse<VideoFile[]>> {
  const { dateWanted, source, forceNew } = params;
  const [year, month, date] = dateWanted.split("-").map((x) => parseInt(x, 10));
  const requestedDate = new Date(Date.UTC(year, month - 1, date));

  // Fetch video source overrides from the wiki for this date. If there are none, then use Imagery Online
  try {
    let mediaOverrides = await WikiService.fetchMediaOverrides(forceNew);

    if (mediaOverrides?.responseMetadata?.retrieverStatus === "inprogress") {
      // try once per second for up to 10 seconds
      let tries = 0;
      while (mediaOverrides?.responseMetadata?.retrieverStatus === "inprogress" && tries < 10) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        mediaOverrides = await WikiService.fetchMediaOverrides();
        tries++;
      }
    }

    // Check if there is a video override for this date and Source
    const relevantMediaOverrides: MediaSourceOverride[] = mediaOverrides?.data?.filter((vo) => {
      return (
        new Date(vo.date).getTime() === requestedDate.getTime() &&
        vo.source === source &&
        vo.type === "video"
      );
    });

    // if there are media overrides, use those instead of IO. Multiple overrides for the same date and source are merged into one here
    if (relevantMediaOverrides.length > 0) {
      const allVideoManifests = await Promise.all(
        relevantMediaOverrides.map((mediaOverride) => OverrideService.getManifest(mediaOverride))
      );
      const videos = _.sortBy(allVideoManifests.flat() as VideoFile[], "startDateTime");

      return {
        responseMetadata: {
          retrieverStatus: "complete",
          cachedTimestamp: null,
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
  const col = collection[source];

  const [ioResults, timeOverrides] = await Promise.all([
    // fetch and parse videos for the requested day, the day before, and the day after
    IoService.fetchData({
      collection: col,
      fetchType: "videos",
      requestedDate,
      forceNew,
    }) as Promise<WrappedResponse<VideoFile[]>>,
    // fetch start time overrides, but don't throw if the request fails
    await (async () => {
      try {
        let dateTimeOverrides = await WikiService.fetchDatetimeOverrides(forceNew);
        if (dateTimeOverrides?.responseMetadata?.retrieverStatus === "inprogress") {
          // try once per second for up to 10 seconds
          let tries = 0;
          while (
            dateTimeOverrides?.responseMetadata?.retrieverStatus === "inprogress" &&
            tries < 10
          ) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            dateTimeOverrides = await WikiService.fetchDatetimeOverrides();
            tries++;
          }
        }
        return dateTimeOverrides;
      } catch (e) {
        // don't block video results if we can't find overrides
        console.error(e);
      }
    })(),
  ]);

  if (!timeOverrides) {
    return ioResults;
  }

  // If we got data (as opposed to an error), apply the overrides
  if (ioResults.data) {
    // if we got overrides from the wiki, apply them
    const data: VideoFile[] = ioResults.data.map((result) => {
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
      ...ioResults,
      data,
    };
  } else {
    return ioResults;
  }
}

export const getVideoCoverageTimeRanges = async (params: {
  dateWanted: string;
  source: Source;
  forceNew: boolean;
}): Promise<VideoCoverageTimeRanges> => {
  const { dateWanted, source, forceNew } = params;
  let videoData = await getVideoData({ dateWanted, source, forceNew });
  if (videoData?.responseMetadata?.retrieverStatus === "inprogress") {
    // try once per second for up to 10 seconds
    let tries = 0;
    while (videoData?.responseMetadata?.retrieverStatus === "inprogress" && tries < 10) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      videoData = await getVideoData({ dateWanted, source, forceNew: false });
      tries++;
    }
  }

  //create an array of video coverage time ranges. Times are in seconds since midnight of the dateWanted to match the transcript time values
  const dateWantedMidnight = new Date(dateWanted).setUTCHours(0, 0, 0, 0);
  const dateWantedMidnightUnix = dateWantedMidnight / 1000;
  const videoCoverageTimeRanges: VideoCoverageTimeRanges = [];
  videoData.data.forEach((video) => {
    // don't include non-downlink videos
    if (video.downlink === -1) {
      return;
    }
    const videoCoverageTimeRange: VideoCoverageTimeRange = [
      video.start - dateWantedMidnightUnix,
      video.end - dateWantedMidnightUnix,
    ];
    videoCoverageTimeRanges.push(videoCoverageTimeRange);
  });

  return videoCoverageTimeRanges;
};
