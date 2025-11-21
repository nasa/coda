import fetchWithTimeout from "utils/fetch-with-timeout";
import { midnightZulu } from "utils/date";
import clone from "lodash/clone";
import { fetchMTXHlsEndpoints } from "./mediaMtx-hls";

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
 */
const fetchMTXPlaybackAvailability = async ({
  sourceAbbr,
}: {
  sourceAbbr: string;
}): Promise<MTXPlaybackAvailability> => {
  const mtxRecordingsBaseUrl = process.env.VITE_PUBLIC_MEDIA_MTX_RECORDINGS_URL;
  const mtxPlaybackAvailability: MTXPlaybackAvailability = {};

  interface MtxRecordingTimeRangeResponse extends MTXRecordingTimeRange {
    url: string;
  }

  for (let channel = 1; channel <= 8; channel++) {
    const mtxPlaybackUrl = `${mtxRecordingsBaseUrl}list?path=DL${channel}_${sourceAbbr}`;
    try {
      const res = await fetchWithTimeout(mtxPlaybackUrl, {}, 20000);
      const rawJson: MtxRecordingTimeRangeResponse[] = await res.json();
      const mtxPlaybackRecords: MTXRecordingTimeRange[] =
        rawJson?.map(({ start, duration }) => ({
          start,
          duration,
        })) || [];

      mtxPlaybackAvailability[channel.toString()] = mtxPlaybackRecords;
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
    const sourceAbbr = source === "ISS" ? "ISS" : "TE";

    // Fetch MTX HLS endpoints
    let mtxHlsEndpoints: MTXHlsEndpoint[] = [];
    try {
      mtxHlsEndpoints = await fetchMTXHlsEndpoints({ sourceAbbr });
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
    const mtxPlaybackAvailability = await fetchMTXPlaybackAvailability({ sourceAbbr });

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
