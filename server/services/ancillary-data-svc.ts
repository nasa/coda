import fetchWithTimeout from "utils/fetch-with-timeout";
import gpxParser from "gpxparser";
import type { GPSTrackCollection } from "typings/ancillary";
import type { Response } from "node-fetch";

export async function fetchGPSTracks(
  dateWanted: string,
  eventType: string
): Promise<GPSTrackCollection> {
  const payloadDescription = await fetchAncillaryPayloadDescription(dateWanted, eventType);

  let payloadObj: GPSTrackCollection;
  if (payloadDescription.includes("Access Denied")) {
    payloadObj = JSON.parse(`{"gps_tracks": []}`);
  } else {
    payloadObj = JSON.parse(payloadDescription);
  }

  const eventFolder = eventType === "ISS" ? "ISS" : "test_events";

  for (let i = 0; i < payloadObj.gps_tracks.length; i++) {
    const url = `${process.env.ANCILLARY_DATA_URL}/${eventFolder}/${dateWanted}/${payloadObj.gps_tracks[i].filename}`;
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

    const res = await fetchWithTimeout(url, options);
    const gpxText = await res.text();

    var gpx = new gpxParser();
    gpx.parse(gpxText);

    const track = {
      name: gpx.tracks[0].name,
      points: gpx.tracks[0].points,
      slopes: gpx.tracks[0].slopes,
    };

    payloadObj.gps_tracks[i].track = track;
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
