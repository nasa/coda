/**
 * Fetches MTX HLS endpoints from the MediaMTX API.
 * Uses the configured HLS buffer duration instead of parsing the m3u8 playlist,
 * since the playlist only shows currently available segments (which grows over time
 * for a live stream) rather than the full configured buffer duration.
 */

/**
 * Get HLS buffer duration from environment variable.
 * This should match MediaMTX config: hlsSegmentCount * hlsSegmentDuration.
 * Default in config: 180 segments * 5 seconds = 900 seconds (15 minutes)
 * @returns HLS buffer duration in seconds
 * @throws Error if HLS_BUFFER_DURATION_SECONDS is not defined or invalid
 */
export const getHlsBufferDuration = (): number => {
  const envValue = process.env.HLS_BUFFER_DURATION_SECONDS;

  if (!envValue) {
    throw new Error(
      "HLS_BUFFER_DURATION_SECONDS is not defined. This indicates a critical environment loading failure."
    );
  }

  const parsed = parseInt(envValue);
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error(`HLS_BUFFER_DURATION_SECONDS must be a positive integer, got: ${envValue}`);
  }

  return parsed;
};

export const fetchMTXHlsEndpoints = async ({
  sourceSuffix,
}: {
  sourceSuffix: string;
}): Promise<MTXHlsEndpoint[]> => {
  const mtxHlsEndpoints: MTXHlsEndpoint[] = [];
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

    // If the stream is ready, use the configured HLS buffer duration
    if (item.ready && sourceSuffix === streamNameSuffix) {
      mtxHlsEndpoints.push({ name: item.name, secondsAvailable: hlsBufferDuration });
    }
  }

  return mtxHlsEndpoints;
};
