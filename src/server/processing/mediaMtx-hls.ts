/**
 * Calculates the total duration of an HLS stream by parsing the m3u8 playlist files.
 */
export const calcHlsDuration = async ({
  endpointName,
}: {
  endpointName: MTXHlsEndpointName;
}): Promise<number> => {
  const indexM3u8Url = `${process.env.VITE_PUBLIC_MEDIA_MTX_HLS_URL}${endpointName}/index.m3u8`;

  // get the m3u8 index
  const indexM3u8Response = await fetch(indexM3u8Url);
  const indexM3u8Text = await indexM3u8Response.text();

  // get the stream m3u8 file from the index
  const indexLines = indexM3u8Text.split("\n");
  let streamM3u8Url = "";
  for (const line of indexLines) {
    if (line.includes(".m3u8")) {
      streamM3u8Url = `${process.env.VITE_PUBLIC_MEDIA_MTX_HLS_URL}${endpointName}/${line.replace(/\n/g, "")}`;
      break;
    }
  }

  // get the m3u8 file
  const m3u8Response = await fetch(streamM3u8Url);

  // parse the m3u8 file
  const m3u8Text = await m3u8Response.text();
  const lines = m3u8Text.split("\n");
  let totalDuration = 0;

  lines.forEach((line) => {
    // Match EXTINF lines
    const extinfMatch = line.match(/^#EXTINF:([\d.]+),/);
    if (extinfMatch) {
      totalDuration += parseFloat(extinfMatch[1]);
    }
  });
  return totalDuration;
};

/**
 * Fetches MTX HLS endpoints from the MediaMTX API.
 */
export const fetchMTXHlsEndpoints = async ({
  sourceAbbr,
}: {
  sourceAbbr: string;
}): Promise<MTXHlsEndpoint[]> => {
  const mtxHlsEndpoints: MTXHlsEndpoint[] = [];
  const auth = `Basic ${Buffer.from(
    `${process.env.MEDIAMTX_USERNAME}:${process.env.MEDIAMTX_PASSWORD}`
  ).toString("base64")}`;

  const mtxApiBaseUrl = process.env.VITE_PUBLIC_MEDIA_MTX_CONTROL_URL;

  const response = await fetch(`${mtxApiBaseUrl}v3/paths/list`, {
    headers: {
      Authorization: auth,
    },
  });

  const mtxResponceJson = await response.json();
  const itemsArray = mtxResponceJson.items;

  for (const item of itemsArray) {
    const streamNameSuffix = item.name.split("_")[1];

    // If the stream is ready, get the length of the HLS stream
    if (item.ready && sourceAbbr === streamNameSuffix) {
      const duration = await calcHlsDuration({ endpointName: item.name });
      mtxHlsEndpoints.push({ name: item.name, secondsAvailable: duration });
    }
  }

  return mtxHlsEndpoints;
};
