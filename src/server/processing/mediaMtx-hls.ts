/**
 * Fetches MTX HLS endpoints from the MediaMTX API.
 * Uses the configured HLS buffer duration instead of parsing the m3u8 playlist,
 * since the playlist only shows currently available segments (which grows over time
 * for a live stream) rather than the full configured buffer duration.
 */
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

  // Use configured HLS buffer duration (default: 900 seconds = 15 minutes)
  // This matches MediaMTX config: hlsSegmentCount (180) * hlsSegmentDuration (5s)
  const hlsBufferDuration = parseInt(process.env.HLS_BUFFER_DURATION_SECONDS);

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
