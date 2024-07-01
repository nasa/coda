import fetchWithTimeout from "utils/fetch-with-timeout";
import { globalValues } from "server/express/global";

/**
 * Fetch video data from EMSS labs where live video is being captured and stored.
 * This labs endpoint contains a videoManifest that mimics the VideoFile type.
 */
export default async function getEMSSVideoData(params: {
  year: number;
  month: number;
  date: number;
  source: Source;
}): Promise<WrappedResponse<VideoFile[]>> {
  const { year, month, date, source } = params;
  const requestedDate = new Date(Date.UTC(year, month - 1, date));

  // If not Source = ISS return an empty array
  if (source !== "ISS") {
    return {
      responseMetadata: {
        retrieverStatus: "complete",
        cachedTimestamp: null,
        expiration: null,
        error: "No data available for this source",
        retrieverErrorCount: 0,
        lastErrorTimestamp: null,
      },
      source: "EMSS",
      data: [],
    };
  }

  // If EMSS video is disabled, return an empty array
  if (!globalValues.emssVideoEnabled) {
    return {
      responseMetadata: {
        retrieverStatus: "complete",
        cachedTimestamp: null,
        expiration: null,
        error: "EMSS video is disabled",
        retrieverErrorCount: 0,
        lastErrorTimestamp: null,
      },
      source: "EMSS",
      data: [],
    };
  }

  const liveVideoManifestUrl = `https://emss-labs.fit.nasa.gov/video/manifests/${requestedDate.toISOString().slice(0, 10)}/videoManifest.json`;
  const liveVideoResults = await fetchWithTimeout(liveVideoManifestUrl);

  if (!liveVideoResults.ok) {
    return {
      responseMetadata: {
        retrieverStatus: "error",
        cachedTimestamp: null,
        expiration: null,
        error: `Error fetching live video data: ${liveVideoResults.statusText}`,
        retrieverErrorCount: 1,
        lastErrorTimestamp: new Date().toISOString(),
      },
      source: "EMSS",
      data: [],
    };
  }
  const liveVideo: VideoFile[] = ((await liveVideoResults.json()) as VideoFile[]) || [];

  // sort the videos by start time
  liveVideo.sort((a, b) => a?.start - b?.start);

  const videoResponse: WrappedResponse<VideoFile[]> = {
    responseMetadata: {
      retrieverStatus: "complete",
      cachedTimestamp: null,
      expiration: null,
      error: null,
      retrieverErrorCount: 0,
      lastErrorTimestamp: null,
    },
    source: "EMSS",
    data: liveVideo,
  };
  return videoResponse;
}
