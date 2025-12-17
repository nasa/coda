import isNil from "lodash/isNil";
import isNull from "lodash/isNull";
import { appSecondsFromDateString } from "utils/formatting";
import { isSameDate } from "utils/date";
import memoize from "lodash/memoize";

/**
 * Check whether the error is the browser blocking autoplay of unmuted videos.
 * See https://developers.google.com/web/updates/2017/09/autoplay-policy-changes
 */
export const isAutoplayError = (e: unknown): boolean => {
  // every browser displays a different error message
  const chrome_autoplay_error =
    /play\(\) failed because the user didn't interact with the document first/i;
  const firefox_autoplay_error =
    /The play method is not allowed by the user agent or the platform in the current context, possibly because the user denied permission/i;
  const safari_autoplay_error =
    /The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission/i;

  const isChromeError = !isNull(e.toString().match(chrome_autoplay_error));
  const isFirefoxError = !isNull(e.toString().match(firefox_autoplay_error));
  const isSafariError = !isNull(e.toString().match(safari_autoplay_error));

  return isChromeError || isFirefoxError || isSafariError;
};

// ============================================================================
// Video Availability Helpers
// ============================================================================

/**
 * Checks if IO video is available for the given channel at the current playhead position.
 */
export function hasIOAvailable(
  visibleVideos: Map<string, string[]>,
  appSeconds: number,
  channel: number
): boolean {
  return !isNil(visibleVideos.get(`${appSeconds + 1}/${channel}`));
}

/**
 * Checks if HLS streaming is available for the given channel at the current playhead position.
 * HLS is available when the playhead is today and within the HLS buffer duration.
 */
export function hasHlsAvailable(
  mtxHlsEndpoints: MTXHlsEndpoint[],
  downlinkNumber: number,
  source: string,
  date: string,
  appSeconds: number
): boolean {
  const now = new Date();
  const playheadDate = new Date(date);
  const nowAppSeconds = appSecondsFromDateString(now.toISOString());

  if (!isSameDate(playheadDate, now)) {
    return false;
  }

  const suffix = source === "ISS" ? "ISS" : "TE";
  const endpointName = `DL${downlinkNumber}_${suffix}` as MTXHlsEndpointName;
  const hlsEndpoint = mtxHlsEndpoints.find((e) => e.name === endpointName);
  const duration = hlsEndpoint?.secondsAvailable ?? 0;

  return Math.abs(appSeconds - nowAppSeconds) < duration;
}

/**
 * Checks if MTX playback is available for the current playhead position.
 * MTX is available when there's a recording that covers the current playhead time.
 */
export function hasMtxAvailable(
  mtxRecords: MTXRecordingTimeRange[] | undefined,
  date: string,
  appSeconds: number
): boolean {
  if (!mtxRecords?.length) {
    return false;
  }

  const playheadDate = new Date(date);

  return mtxRecords.some((record) => {
    // MTX records were modified when fetched to look like they started at 00:00 today
    // if they started before today
    if (!isSameDate(new Date(record.start), playheadDate)) {
      return false;
    }

    const recordStartAppSeconds = appSecondsFromDateString(record.start);
    return (
      appSeconds >= recordStartAppSeconds && appSeconds < recordStartAppSeconds + record.duration
    );
  });
}

/**
 * Calculate video availability for all 8 channels at current playhead time.
 * A channel is available if any source (IO, HLS, MTX) has video.
 */
export function calculateChannelAvailability(
  date: string,
  appSeconds: number,
  visibleVideos: Map<string, string[]>,
  mtxPlaybackAvailability: MTXPlaybackAvailability,
  mtxHlsEndpoints: MTXHlsEndpoint[],
  source: string,
  liveEnabled: boolean
): boolean[] {
  const availability: boolean[] = [];

  for (let channel = 0; channel < 8; channel++) {
    const downlinkNumber = channel + 1;
    const hasIo = hasIOAvailable(visibleVideos, appSeconds, channel);

    if (!liveEnabled) {
      availability.push(hasIo);
      continue;
    }

    const hasMtx = hasMtxAvailable(mtxPlaybackAvailability[downlinkNumber], date, appSeconds);
    const hasHls = hasHlsAvailable(mtxHlsEndpoints, downlinkNumber, source, date, appSeconds);

    availability.push(hasMtx || hasIo || hasHls);
  }

  return availability;
}

// ============================================================================
// Video Data Structure Helpers
// ============================================================================

/** Map seconds and downlinks to videos */
const _visibleVideosBySecond = (videos: VideoFile[], date: Date): Map<string, string[]> => {
  const ret = new Map<string, string[]>();
  const startUTC = date.valueOf() / 1000;

  videos.forEach((video) => {
    for (let v = video.start; v <= Math.floor(video.end); v++) {
      // key in the form of "seconds-into-day/downlink"
      const key = `${v - startUTC}/${video.downlink}`;
      // value in the form of [videoID, ...]
      ret.set(key, [...(ret.get(key) ?? []), video.id]);
    }
  });

  return ret;
};

/**
 * Create a data structure that maps seconds and downlinks to videos. Each key is in the form of "second/downlink", eg. "86399/6", indicating a video playing at 23:59 on downlink 6. The value is a list of video IDs playing at that second. Missing keys represent "second/downlink" without any videos. Keys can be iterated in ascending chronological order, but downlink order is not guaranteed
 */
export const visibleVideosBySecond = memoize(
  _visibleVideosBySecond,
  (videos: VideoFile[], date: Date) => `${videos.length}/${date.toISOString()}`
);

/** Filters videos for start and end dates that overlap a given day */
const _filterVisibleVideos = (videos: VideoFile[], date: Date): VideoFile[] => {
  const startOfDay = date.valueOf() / 1000;
  const endOfDay = startOfDay + 86399;
  return videos.filter((video) => {
    return video.start < endOfDay && video.end > startOfDay;
  });
};

/** Return a list of all videos that cover some part of the day */
export const filterVisibleVideos = memoize(
  _filterVisibleVideos,
  (videos: VideoFile[], date: Date) => `${videos.length}/${date.toISOString()}`
);

// ============================================================================
// Video Player Type Determination
// ============================================================================

/**
 * Determines which video player type to use based on available sources.
 *
 * Priority:
 * 1. IO video (Imagery Online) - highest priority if available
 * 2. HLS - for near-live streaming within the available HLS window
 * 3. MTX - for recorded MediaMTX playback
 * 4. Returns "NONE" if no video source is available
 */
export function determineVideoPlayerType({
  downlinkNumber,
  mtxPlaybackRecordsForDownlink,
  videos,
  date,
  appSeconds,
  source,
}: {
  downlinkNumber: number;
  mtxPlaybackRecordsForDownlink: MTXRecordingTimeRange[] | undefined;
  videos: VideosState;
  date: string;
  appSeconds: number;
  source: string;
}): VideoPlayerType {
  if (downlinkNumber !== -1) {
    const visibleVideos = visibleVideosBySecond(videos.videoFiles, new Date(date));
    if (hasIOAvailable(visibleVideos, appSeconds, downlinkNumber - 1)) {
      return "IO";
    }
  }

  if (hasHlsAvailable(videos.mtxHlsEndpoints, downlinkNumber, source, date, appSeconds)) {
    return "HLS";
  }

  if (hasMtxAvailable(mtxPlaybackRecordsForDownlink, date, appSeconds)) {
    return "MTX";
  }

  return "NONE";
}
