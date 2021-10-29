import fetchWithTimeout from "utils/fetch-with-timeout";
import gpxParser from "gpxparser";
import type { AncillaryPayload, AncillaryPhoto } from "typings/ancillary";
import type { Response } from "node-fetch";
import type GpxParser from "gpxparser";
import fetchWithCache from "./cache-client";

export async function fetchAncillaryData(
  dateWanted: string,
  eventType: string
): Promise<AncillaryPayload> {
  const payloadDescription = await fetchAncillaryPayloadDescription(dateWanted, eventType);

  let payloadObj: AncillaryPayload = {
    getPhotos: false,
    gps_tracks: [],
  };

  if (!payloadDescription.includes("Access Denied")) {
    const receivedPayload: AncillaryPayload = JSON.parse(payloadDescription);
    payloadObj = { ...payloadObj, ...receivedPayload };
  }

  const eventFolder = eventType === "ISS" ? "ISS" : "test_events";

  // get and add GPS tracks to payload
  for (let i = 0; i < payloadObj.gps_tracks.length; i++) {
    const underscoreDate = dateWanted.replace(/-/g, "_");
    const url = `${process.env.ANCILLARY_DATA_URL}/${eventFolder}/${dateWanted}/GPS/${payloadObj.gps_tracks[i].identifier}_GPS_${underscoreDate}/${payloadObj.gps_tracks[i].identifier}_GPS_${underscoreDate}.gpx`;

    const options = {
      timeout: 10000,
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Encoding": "gzip,deflate,br",
        "Accept-Language": "en-US,en;q=0.9",
        Connection: "keep-alive",
        Origin: process.env.HOST,
      },
    };

    // const res = await fetchWithTimeout(url, options);
    // const gpxText = await res.text();

    const gpxResponse = await fetchWithCache<GpxParser>(
      url,
      async () => {
        const res = await fetchWithTimeout(url, options);
        const gpxText = await res.text();
        var gpx = new gpxParser();
        gpx.parse(gpxText);
        return gpx;
      },
      {
        cacheAge: 3600,
        staleOk: true,
        preferNew: false,
      }
    );

    const gpx = gpxResponse.data;

    const track = {
      name: gpx.tracks[0].name,
      points: gpx.tracks[0].points,
      slopes: gpx.tracks[0].slopes,
    };

    payloadObj.gps_tracks[i].track = track;
  }

  // get and add ancillary photos metadata to payload
  if (payloadObj.getPhotos) {
    const url = `${process.env.ANCILLARY_DATA_URL}/${eventFolder}/${dateWanted}/Photo/photoMetadata.json`;

    const options = {
      timeout: 10000,
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Encoding": "gzip,deflate,br",
        "Accept-Language": "en-US,en;q=0.9",
        Connection: "keep-alive",
        Origin: process.env.HOST,
      },
    };

    // const res = await fetchWithTimeout(url, options);
    // const gpxText = await res.text();

    const ancillaryPhotos = await fetchWithCache<AncillaryPhoto[]>(
      url,
      async () => {
        const res = await fetchWithTimeout(url, options);
        const photoJson = await res.json();
        return photoJson;
      },
      {
        cacheAge: 3600,
        staleOk: true,
        preferNew: false,
      }
    );

    payloadObj.photos = ancillaryPhotos.data;
  }

  return payloadObj;
}

async function fetchAncillaryPayloadDescription(
  dateWanted: string,
  eventType: string
): Promise<string> {
  const eventFolder = eventType === "ISS" ? "ISS" : "test_events";
  const url = `${process.env.ANCILLARY_DATA_URL}/${eventFolder}/${dateWanted}/payload.json`;
  const options = {
    timeout: 10000,
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Accept-Encoding": "gzip,deflate,br",
      "Accept-Language": "en-US,en;q=0.9",
      Connection: "keep-alive",
      Origin: process.env.HOST,
    },
  };

  let res: Response;
  try {
    res = await fetchWithTimeout(url, options);
  } catch (e) {
    throw e;
  }
  return await res.text();
}
