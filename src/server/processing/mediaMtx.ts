import fetchWithTimeout from "utils/fetch-with-timeout";
import { midnightZulu } from "utils/date";
import clone from "lodash/clone";
import { fetchMTXHlsEndpoints } from "./mediaMtx-hls";
import { getSourceSuffix } from "utils/video";

/**
 * Maximum gap (in seconds) between segments that will be merged into a single time range.
 * MediaMTX segments recordings into files, and there can be small gaps between segments
 * due to file finalization, network hiccups, or source stream interruptions.
 * Segments with gaps smaller than this threshold are merged to provide smoother playback.
 */
export const MAX_SEGMENT_GAP_SECONDS = 15;

/**
 * Merges consecutive MTX recording segments that are close together (within MAX_SEGMENT_GAP_SECONDS).
 * This helps smooth over small gaps caused by MediaMTX's segment-based recording.
 *
 * MediaMTX returns individual segment files, each with their own start time and duration.
 * When there are small gaps between segments (e.g., during file finalization), the raw
 * segment list can cause choppy playback or false "no video available" states.
 *
 * This function merges segments that are close together into larger continuous time ranges.
 */
export const mergeConsecutiveSegments = (
  segments: MTXRecordingTimeRange[]
): MTXRecordingTimeRange[] => {
  if (!segments || segments.length === 0) return [];

  // Sort segments by start time
  const sortedSegments = [...segments].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  const mergedSegments: MTXRecordingTimeRange[] = [];
  let currentMerged: MTXRecordingTimeRange | null = null;

  for (const segment of sortedSegments) {
    const segmentStartMs = new Date(segment.start).getTime();
    const segmentEndMs = segmentStartMs + segment.duration * 1000;

    if (!currentMerged) {
      // Start a new merged segment
      currentMerged = { ...segment };
    } else {
      const currentEndMs = new Date(currentMerged.start).getTime() + currentMerged.duration * 1000;
      const gapMs = segmentStartMs - currentEndMs;

      if (gapMs <= MAX_SEGMENT_GAP_SECONDS * 1000) {
        // Merge this segment into the current one
        // The new duration extends from the original start to the end of this segment
        const newDurationMs = segmentEndMs - new Date(currentMerged.start).getTime();
        currentMerged.duration = newDurationMs / 1000;
      } else {
        // Gap too large, save current merged segment and start a new one
        mergedSegments.push(currentMerged);
        currentMerged = { ...segment };
      }
    }
  }

  // Don't forget the last merged segment
  if (currentMerged) {
    mergedSegments.push(currentMerged);
  }

  return mergedSegments;
};

/**
 * Adjusts MTX playback records to fit within a single day boundary.
 * Playback records can span multiple days, but CODA can only play one day at a time.
 * This function modifies the playback ranges to only show the portion available for the current day.
 */
export const adjustPlaybackRangesForDay = ({
  mtxPlaybackAvailability,
  dateWanted,
}: {
  mtxPlaybackAvailability: MTXPlaybackAvailability;
  dateWanted: string;
}): MTXPlaybackAvailability => {
  const dateWantedDate = midnightZulu(new Date(dateWanted));
  const newMtxPlaybackAvailability: MTXPlaybackAvailability = {};

  for (let channel = 1; channel <= 8; channel++) {
    const channelKey = channel.toString();
    if (!mtxPlaybackAvailability[channelKey]) {
      continue;
    }

    const mtxPlaybackRecords = clone(mtxPlaybackAvailability[channelKey]);
    const newMtxPlaybackRecords: MTXRecordingTimeRange[] = [];

    for (const mtxPlaybackRecord of mtxPlaybackRecords) {
      const recordStartTime = new Date(mtxPlaybackRecord.start).getTime();
      const recordEndTime = recordStartTime + mtxPlaybackRecord.duration * 1000;
      const dayStartTime = dateWantedDate.getTime();
      const dayEndTime = dayStartTime + 86400000; // 24 hours in milliseconds

      // Record starts before the beginning of the day
      if (recordStartTime < dayStartTime) {
        // Check if the record ends after the beginning of the day
        if (recordEndTime > dayStartTime) {
          const adjustedRecord = { ...mtxPlaybackRecord };

          // Adjust start time to the beginning of the day
          adjustedRecord.start = dateWantedDate.toISOString();

          // Adjust duration to account for the new start time
          adjustedRecord.duration =
            mtxPlaybackRecord.duration - (dayStartTime - recordStartTime) / 1000;

          // If the record extends beyond the current day, cap it at day's end
          if (recordEndTime > dayEndTime) {
            adjustedRecord.duration = 86400; // 24 hours in seconds
          }

          newMtxPlaybackRecords.push(adjustedRecord);
        }
      } else {
        // Record starts on or after the beginning of the day
        newMtxPlaybackRecords.push(mtxPlaybackRecord);
      }
    }

    newMtxPlaybackAvailability[channelKey] = newMtxPlaybackRecords;
  }

  return newMtxPlaybackAvailability;
};

/**
 * Fetches MTX playback availability for all channels.
 * Merges consecutive segments with small gaps to provide smoother playback.
 */
const fetchMTXPlaybackAvailability = async ({
  sourceSuffix,
}: {
  sourceSuffix: string;
}): Promise<MTXPlaybackAvailability> => {
  const mtxRecordingsBaseUrl = process.env.VITE_PUBLIC_MEDIA_MTX_RECORDINGS_URL;
  const mtxPlaybackAvailability: MTXPlaybackAvailability = {};

  interface MtxRecordingTimeRangeResponse extends MTXRecordingTimeRange {
    url: string;
  }

  for (let channel = 1; channel <= 8; channel++) {
    const mtxPlaybackUrl = `${mtxRecordingsBaseUrl}list?path=DL${channel}_${sourceSuffix}`;
    try {
      const res = await fetchWithTimeout(mtxPlaybackUrl, {}, 20000);
      const rawJson: MtxRecordingTimeRangeResponse[] = await res.json();
      const mtxPlaybackRecords: MTXRecordingTimeRange[] =
        rawJson?.map(({ start, duration }) => ({
          start,
          duration,
        })) || [];

      // Merge consecutive segments with small gaps to smooth over recording fragmentation
      mtxPlaybackAvailability[channel.toString()] = mergeConsecutiveSegments(mtxPlaybackRecords);
    } catch (e) {
      mtxPlaybackAvailability[channel.toString()] = [];
    }
  }

  return mtxPlaybackAvailability;
};

export const getMTXAPIResponses = async ({
  dateWanted,
  source,
}: {
  dateWanted: string;
  source: Source;
}): Promise<FetchResponse<MTXApiResponses>> => {
  try {
    const sourceSuffix = getSourceSuffix(source);

    // Fetch MTX HLS endpoints
    let mtxHlsEndpoints: MTXHlsEndpoint[] = [];
    try {
      mtxHlsEndpoints = await fetchMTXHlsEndpoints({ sourceSuffix });
    } catch (e) {
      // If the MTX API is down, return an empty object
      return {
        data: {
          mtxPlaybackAvailability: {},
          mtxHlsEndpoints: [],
        },
        fetchMetadata: {
          success: false,
          error: e instanceof Error ? e.message : "Failed to fetch MTX HLS endpoints",
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Fetch MTX playback availability for all channels
    const mtxPlaybackAvailability = await fetchMTXPlaybackAvailability({ sourceSuffix });

    // Adjust playback ranges to fit within the requested day
    const newMtxPlaybackAvailability = adjustPlaybackRangesForDay({
      mtxPlaybackAvailability,
      dateWanted,
    });

    return {
      data: {
        mtxPlaybackAvailability: newMtxPlaybackAvailability,
        mtxHlsEndpoints,
      },
      fetchMetadata: {
        success: true,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      data: {
        mtxPlaybackAvailability: {},
        mtxHlsEndpoints: [],
      },
      fetchMetadata: {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        timestamp: new Date().toISOString(),
      },
    };
  }
};
