import fetchWithTimeout from "utils/fetch-with-timeout";
import { midnightZulu } from "utils/date";
import clone from "lodash/clone";
import { getHlsBufferDuration } from "./mediaMtx-hls";

export const getMTXAPIResponses = async ({
  dateWanted,
  source,
}: {
  dateWanted: string;
  source: Source;
}): Promise<FetchResponse<MTXApiResponses>> => {
  try {
    const sourceAbbr = source === "ISS" ? "ISS" : "TE";

    /**
     * Get the mtxHls endpoints and the duration of hls streams
     * Uses the configured HLS buffer duration instead of parsing the m3u8 playlist,
     * since the playlist only shows currently available segments (which grows over time
     * for a live stream) rather than the full configured buffer duration.
     */
    const mtxHlsEndpoints: MTXHlsEndpoint[] = [];
    // we hit this to get a list of current live endpoint names from mediamtx
    try {
      const auth = `Basic ${Buffer.from(
        `${process.env.MEDIAMTX_USERNAME}:${process.env.MEDIAMTX_PASSWORD}`
      ).toString("base64")}`;

      const mtxApiBaseUrl = process.env.VITE_PUBLIC_MEDIA_MTX_CONTROL_URL;

      // Use configured HLS buffer duration
      const hlsBufferDuration = getHlsBufferDuration();

      const response = await fetch(`${mtxApiBaseUrl}v3/paths/list`, {
        headers: {
          Authorization: auth,
        },
      });
      const mtxResponceJson = await response.json();
      const itemsArray = mtxResponceJson.items;
      for (const item of itemsArray) {
        const streamNameSuffix = item.name.split("_")[1];

        // if the stream is ready, use the configured HLS buffer duration
        if (item.ready && sourceAbbr === streamNameSuffix) {
          mtxHlsEndpoints.push({ name: item.name, secondsAvailable: hlsBufferDuration });
        }
      }
    } catch (e) {
      // if the mtxApi is down, return an empty object
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
        origin: "mtx",
      };
    }

    /**
     * Hit the newly sped up mtxPlayback API to get the recorded playback availability
     */
    const mtxRecordingsBaseUrl = process.env.VITE_PUBLIC_MEDIA_MTX_RECORDINGS_URL;

    // loop through the 8 channels and get the mtxPlayback records for each channel
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

    /**
     * Check all the mtxPlayback records for their start times and duration
     * These playback records can span multiple days, but CODA can only play one day at a time
     * This function modifies the playback ranges to only show the portion of the playback that is available for the current day
     * */

    const dateWantedDate = midnightZulu(new Date(dateWanted));
    const newMtxPlaybackAvailability: MTXPlaybackAvailability = {};

    for (let channel = 1; channel <= 8; channel++) {
      if (!mtxPlaybackAvailability[channel.toString()]) {
        continue;
      }
      const mtxPlaybackRecords = clone(mtxPlaybackAvailability[channel.toString()]);
      const newMtxPlaybackRecords: MTXRecordingTimeRange[] = [];

      for (const mtxPlaybackRecord of mtxPlaybackRecords) {
        // the mtx playback record starts before the beginning of today, check if it ends after the beginning of today
        if (new Date(mtxPlaybackRecord.start).getTime() < dateWantedDate.getTime()) {
          const mtxDLEndDate =
            new Date(mtxPlaybackRecord.start).getTime() + mtxPlaybackRecord.duration * 1000;

          // if the segment ends after the beginning of today, then we use it by making the start time the beginning of today
          // and adjust the duration so it renders properly
          if (mtxDLEndDate > dateWantedDate.getTime()) {
            mtxPlaybackRecord.duration =
              mtxPlaybackRecord.duration -
              (dateWantedDate.getTime() - new Date(mtxPlaybackRecord.start).getTime()) / 1000;

            // if the clip, even with the adjusted start time and duration longer than the current day, then we adjust the duration to be the length of the current day
            if (mtxDLEndDate > dateWantedDate.getTime() + 86400000) {
              mtxPlaybackRecord.duration = 86400;
            }
            mtxPlaybackRecord.start = dateWantedDate.toISOString();
            newMtxPlaybackRecords.push(mtxPlaybackRecord);
          }
        } else {
          // the mtx playback record starts on or after the beginning of today
          newMtxPlaybackRecords.push(mtxPlaybackRecord);
        }
      }
      newMtxPlaybackAvailability[channel.toString()] = newMtxPlaybackRecords;
    }

    return {
      data: {
        mtxPlaybackAvailability: newMtxPlaybackAvailability,
        mtxHlsEndpoints,
      },
      fetchMetadata: {
        success: true,
        timestamp: new Date().toISOString(),
      },
      origin: "mtx",
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
      origin: "mtx",
    };
  }
};
