import fetchWithTimeout from "utils/fetch-with-timeout";
import gpxParser from "gpxparser";
import type {
  AncillaryDataRaw,
  AncillaryMetadata,
  AncillaryPhoto,
  AncillaryVideo,
  GPSTrack,
} from "typings/ancillary";
import type { Response } from "node-fetch";
import type GpxParser from "gpxparser";
import fetchWithCache from "./cache-client";

export async function fetchAncillaryData(
  dateWanted: string,
  eventType: string
): Promise<AncillaryDataRaw> {
  const payloadDescription = await fetchAncillaryPayloadDescription(dateWanted, eventType);

  let payloadObj: AncillaryMetadata = {
    getPhotos: false,
    getVideos: false,
    gpsIdentifiers: [],
  };

  if (!payloadDescription.includes("Access Denied")) {
    const receivedPayload: AncillaryMetadata = JSON.parse(payloadDescription);
    payloadObj = { ...payloadObj, ...receivedPayload };
  }

  const eventFolder = eventType === "ISS" ? "ISS" : "test_events";

  const ancillaryData: AncillaryDataRaw = { gpsTracks: [], photos: [], videos: [] };

  // get and add GPS tracks to payload
  for (let i = 0; i < payloadObj.gpsIdentifiers.length; i++) {
    const thisGPSTrack = await getGPXTrack(
      dateWanted,
      eventFolder,
      payloadObj.gpsIdentifiers[i].filename,
      payloadObj.gpsIdentifiers[i].identifier
    );
    ancillaryData.gpsTracks.push(thisGPSTrack);
  }

  // if the payload.json says to get photo data, get and add ancillary photos metadata to payload
  if (payloadObj.getPhotos) {
    ancillaryData.photos = await getAncillaryPhotos(eventFolder, dateWanted);
  }

  // if the payload.json says to get video data,  get and add ancillary videos metadata to payload
  if (payloadObj.getVideos) {
    ancillaryData.videos = await getAncillaryVideos(eventFolder, dateWanted);
  }

  return ancillaryData;
}

async function getGPXTrack(dateWanted, eventFolder, filename, identifier): Promise<GPSTrack> {
  const url = `${process.env.ANCILLARY_DATA_URL}/${eventFolder}/${dateWanted}/GPS/${filename}/${filename}.gpx`;

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

  const track: GPSTrack = {
    name: identifier,
    points: gpx.tracks[0].points,
    slopes: gpx.tracks[0].slopes,
  };

  return track;
}

async function getAncillaryPhotos(eventFolder, dateWanted): Promise<AncillaryPhoto[]> {
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

  const photosArray = ancillaryPhotos.data;
  // sort all photos by timestamp taken
  photosArray.sort((a, b) =>
    a.dateTimeOriginal < b.dateTimeOriginal ? -1 : a.dateTimeOriginal > b.dateTimeOriginal ? 1 : 0
  );
  return photosArray;
}

async function getAncillaryVideos(eventFolder, dateWanted): Promise<AncillaryVideo[]> {
  const url = `${process.env.ANCILLARY_DATA_URL}/${eventFolder}/${dateWanted}/Video/videoMetadata.json`;

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
  const ancillaryVideos = await fetchWithCache<AncillaryVideo[]>(
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

  const videosArray = ancillaryVideos.data;
  // sort all photos by timestamp taken
  videosArray.sort((a, b) => (a.dateTime < b.dateTime ? -1 : a.dateTime > b.dateTime ? 1 : 0));

  return videosArray;
}

async function fetchAncillaryPayloadDescription(
  dateWanted: string,
  eventType: string
): Promise<string> {
  const eventFolder = eventType === "ISS" ? "ISS" : "test_events";
  const url = `${process.env.ANCILLARY_DATA_URL}/${eventFolder}/${dateWanted}/ancillaryMetadata.json`;
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
