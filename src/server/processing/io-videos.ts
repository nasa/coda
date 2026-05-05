import clone from "lodash/cloneDeep";
import sortBy from "lodash/sortBy";
import { fetchIoData, fetchForgedIoManifest } from "server/processing/io-api";
import { collection } from "utils/consts";
import { getPublicMediaOverridesList } from "server/express/routes/db/mediaOverrides";
import { getVideoStartTimeOverridesRecordsList } from "server/express/routes/db/video";
import { getAssetOverridesForDate } from "server/express/routes/db/assetOverrides";
import ConsoleLogger from "utils/logging/consoleLogger";

/**
 * Fetch video data from IO. We can't always trust the accuracy of IO's dates, so we fetch videos from the day before and day after as well
 */
export default async function getVideoData({
  dateWanted,
  source,
}: {
  dateWanted: string;
  source: Source;
}): Promise<FetchResponse<VideoFile[]>> {
  const buildResponse = ({
    data,
    error,
    origin,
  }: {
    data?: VideoFile[];
    error?: string | undefined;
    origin?: string;
  }): FetchResponse<VideoFile[]> => ({
    data: data ?? [],
    fetchMetadata: {
      success: !error,
      error,
      timestamp: new Date().toISOString(),
    },
    origin: origin ?? "io",
  });

  try {
    const [year, month, date] = dateWanted.split("-").map((x) => parseInt(x, 10));
    const requestedDate = new Date(Date.UTC(year, month - 1, date));

    // Fetch video source overrides from the db for this date. If there are none, then use Imagery Online
    let mediaOverrides: MediaOverride[] | undefined;
    try {
      mediaOverrides = await getPublicMediaOverridesList();
    } catch (overrideError) {
      // don't block results if media overrides call fails
      ConsoleLogger.warn("Error fetching media overrides:", overrideError);
    }
    // Check if there is a video override for this date and Source
    const relevantMediaOverrides: MediaOverride[] =
      mediaOverrides?.filter((vo) => {
        return (
          new Date(vo.date).getTime() === requestedDate.getTime() &&
          vo.source === source &&
          vo.type === "video"
        );
      }) ?? [];

    // if there are media overrides, use those instead of IO. Multiple overrides for the same date and source are merged into one here
    if (relevantMediaOverrides.length > 0) {
      const allVideoManifests = await Promise.all(
        relevantMediaOverrides.map((mediaOverride) => fetchForgedIoManifest(mediaOverride))
      );
      const videos = sortBy(allVideoManifests.flat() as VideoFile[], "startDateTime");
      return buildResponse({ data: videos, origin: "database" });
    }

    if (!source) {
      throw new Error("Source is required to fetch video data");
    }

    // fetch video info and fudge factors in parallel
    const col = collection[source];
    if (col === undefined || col === null) {
      throw new Error(`Unable to resolve IO collection for source ${source}`);
    }

    // Per-asset channel overrides, scoped by source + date range
    let channelOverrideMap: Record<string, number> = {};
    try {
      channelOverrideMap = await getAssetOverridesForDate<number>(
        "video-channel",
        source,
        dateWanted
      );
    } catch (channelOverrideErr) {
      ConsoleLogger.warn("Error fetching video-channel asset overrides:", channelOverrideErr);
    }

    // fetch and parse videos for the requested day, the day before, and the day after
    const [ioVideos, timeOverrides] = await Promise.all([
      fetchIoData({
        collection: col,
        fetchType: "videos",
        requestedDate,
        channelOverrideMap,
      }) as Promise<VideoFile[]>,
      // fetch start time overrides, but don't throw if the request fails
      (async () => {
        try {
          return await getVideoStartTimeOverridesRecordsList();
        } catch (timeOverrideError) {
          // don't block video results if we can't find overrides
          ConsoleLogger.warn("Error fetching video time overrides:", timeOverrideError);
          return undefined;
        }
      })(),
    ]);

    if (!timeOverrides || timeOverrides.length === 0) {
      return buildResponse({ data: ioVideos ?? [] });
    }

    const data: VideoFile[] = (ioVideos ?? []).map((result) => {
      const res = clone(result);
      for (const fix of timeOverrides) {
        if (fix.videoId === result.id) {
          const duration = res.end - res.start;
          const start = new Date(fix.startTime).valueOf() / 1000;
          res.start = start;
          res.end = start + duration;
          break;
        }
      }
      return res;
    });

    return buildResponse({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error fetching video data";
    return buildResponse({ error: message });
  }
}

export const getVideoCoverageTimeRanges = async ({
  dateWanted,
  source,
}: {
  dateWanted: string;
  source: Source;
}): Promise<VideoCoverageTimeRanges> => {
  const videoData = await getVideoData({ dateWanted, source });

  if (!videoData.fetchMetadata.success || !videoData.data) {
    return [];
  }

  const dateWantedMidnight = new Date(dateWanted).setUTCHours(0, 0, 0, 0);
  const dateWantedMidnightUnix = dateWantedMidnight / 1000;
  const videoCoverageTimeRanges: VideoCoverageTimeRanges = [];

  videoData.data.forEach((video) => {
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
