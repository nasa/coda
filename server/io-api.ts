/*
Methods for fetching from Imagery Online (IO)

Known query parameters:
    s_dt - start date
    e_dt - end date
    as=2 - filetype: video
    as=1 - filetype: photo
    so=7 - sort oldest date taken first
    go=0 - 0 - No filter (default) 1 - Ground-based imagery 2 - On-orbit imagery (IO metadata doesn't seem to support this)
    ie=0 - 0 - No filter (default) 1 - Interior imagery 2 - Exterior imagery (IO metadata doesn't seem to support this)
    cols=4 - 4 - ISS Missions. Full list https://io.jsc.nasa.gov/api/search
*/
import { isSameDate } from "store/playhead";
import { padZeros, appSecondsFromDateString } from "utils/formatting";
import type { IOResponse, WrappedResponse } from "typings";
import type { Doc, PhotoFile, VideoFile } from "typings/io";
import fetchWithCache from "./cache-client";
import fetchWithTimeout from "./fetch-with-timeout";

/** Perform a request against IO with the given parameters */
async function fetchIO(params: string, action?: string): Promise<IOResponse> {
  const isLocal = process.env.NEXT_PUBLIC_APP_ENV === "local";

  if (isLocal) {
    if (action === "videoData") {
      // we're in the local environment. mock the request
      console.log("Mocking request for getVideoData()");
      let mockIOData: IOResponse = require("../mocks/fakedata/io_videos.json");

      // mock the request with local data
      return await Promise.resolve(mockIOData);
    }

    if (action === "photoData") {
      console.log("Mocking request for getPhotoData()");
      const mockIOData: IOResponse = require("../mocks/fakedata/io_photos.json");

      // mock the request with local data
      return await Promise.resolve(mockIOData);
    }
  }

  const url = `${process.env.IO_API_URL}&${params}?key=${process.env.IO_KEY}&format=json`;
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
  return res.json();
}

function formatDateQuery(year: number, month: number, date: number): string {
  const rangeStartYear = year;
  const rangeStartMonth = padZeros(month, 2);
  const rangeStartDate = padZeros(date, 2);
  const rangeEndYear = year;
  const rangeEndMonth = padZeros(month, 2);
  const rangeEndDate = padZeros(date, 2);

  const rangeStartIO = `${rangeStartMonth}-${rangeStartDate}-${rangeStartYear}`;
  const rangeEndIO = `${rangeEndMonth}-${rangeEndDate}-${rangeEndYear}`;

  return `s_dt=${rangeStartIO}&e_dt=${rangeEndIO}`;
}

/**
 * Fetch video data from IO
 */
export async function getVideoData(
  year: number,
  month: number,
  date: number
): Promise<WrappedResponse<VideoFile[]>> {
  const now = new Date();
  const isToday = isSameDate(now, new Date(Date.UTC(year, month - 1, date)));
  const dateQuery = formatDateQuery(year, month, date);

  const retriever = async () => {
    const queryParams = `${dateQuery}&as=2`;
    const res = await fetchIO(queryParams, "videoData");
    return parseIOVideoResponse(res);
  };

  return fetchWithCache<VideoFile[]>(`io/videos/${dateQuery}`, retriever, {
    preferNew: isToday,
  });
}

function parseIOVideoResponse(res: IOResponse) {
  const { docs } = res.results.response;
  const videos: VideoFile[] = [];

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const metadata = parseVideoResultMetadata(doc);
    videos.push(metadata);
  }
  videos.sort(videoSorter);

  return videos;
}

/**
 * Sorts by priority first, then duration second. This sorting is later used to choose the item with the highest array position for the preferred video stream for a given group and time.
 */
export const videoSorter = (a: VideoFile, b: VideoFile) => {
  return (
    +(a.priority < b.priority) ||
    +(a.priority === b.priority) ||
    +(a.durationSeconds < b.durationSeconds) ||
    +(a.durationSeconds === b.durationSeconds)
  );
};

/** Parse the video result for relevant information */
function parseVideoResultMetadata(doc: Doc): VideoFile {
  let className = "";
  let content = "";
  let group = -1;

  const channel = getChannel(doc.collections_string);

  if (channel) {
    if (["01", "02", "03", "04", "05", "06"].indexOf(channel) > -1) {
      className = `downlink-${channel}`;
      group = parseInt(channel) - 1;
    }
  } else {
    className = "non-downlink-video";
    content = `Non-Downlink: ${doc.md_title}`;
    group = 6;
  }

  // Create array of date elements from creation date
  const dateArr = doc.md_creation_date
    // regex match for the date
    .match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z/)
    // remove the first item (the full matched string)
    .slice(1)
    .map(function (n) {
      return parseInt(n);
    });

  // trust the nasa_id over the md_creation_date
  const id_metadata = doc.nasa_id.match(/iss\d{3}m(\d)(\d)\d+(\d{2})(\d{2})/);
  if (id_metadata && id_metadata[1] === "5") {
    dateArr[3] = +id_metadata[3];
    dateArr[4] = +id_metadata[4];
    dateArr[5] = 0;
    className = "downlink-LOS";
  }

  // create date object. Note, month is 0-11 in javascript.
  const UTCstartMilliseconds = Date.UTC(
    dateArr[0],
    dateArr[1] - 1,
    dateArr[2],
    dateArr[3],
    dateArr[4],
    dateArr[5]
  );
  const UTCstart = new Date(UTCstartMilliseconds);
  const duration_ms = (doc.duration_seconds || 0) * 1000;
  const UTCend = new Date(UTCstartMilliseconds + duration_ms);

  var url = `${process.env.IO_HOST}/app/info.cfm?pid=${doc.id}`;

  // if we are using mock data, then stream a mock video file in place of all video files
  // this allows dev to continue with VPN off
  const isLocal = process.env.NEXT_PUBLIC_APP_ENV === "local";
  const videoURL =
    isLocal && process.env.IO_MOCK_MEDIA_URL
      ? process.env.IO_MOCK_MEDIA_URL + "mock_video_lq.mp4"
      : `${process.env.IO_HOST}${doc.webpath}/video/${doc.nasa_id}.${doc.file_extension_video}`;

  // derive mission second values for this video
  const startOfDay = new Date(`${UTCstart.toISOString().split("T")[0]}T00:00:00Z`);
  const missionSecondsStart = (UTCstart.getTime() - startOfDay.getTime()) / 1000;
  const missionSecondsEnd = (UTCend.getTime() - startOfDay.getTime()) / 1000;
  const durationSeconds = missionSecondsEnd - missionSecondsStart;

  const videoFile: VideoFile = {
    id: doc.nasa_id,
    content,
    description: doc.description || "",
    start: UTCstart.toUTCString(),
    end: UTCend.toUTCString(),
    url,
    videoURL,
    className,
    priority: className === "downlink-LOS" ? 0 : 1,
    md_creation_date: doc.md_creation_date,
    group,
    missionSecondsStart,
    missionSecondsEnd,
    durationSeconds,
    collections_string: doc.collections_string[doc.collections_string.length - 1], //last and longest string in the array
    collections_string_pretty: cleanCollectionsString(
      doc.collections_string[doc.collections_string.length - 1]
    ),
  };

  return videoFile;
}

/**
 * Pull a channel from the IO response of available channels. Exported for testing purposes.
 */
export function getChannel(collectionStrings: string[]): string {
  for (let j = 0; j < collectionStrings.length; j++) {
    const chMatch = collectionStrings[j].match(/US Downlink\|Channel (\d+)/);

    if (chMatch) {
      return padZeros(parseInt(chMatch[1]), 2);
    }
  }
  return "";
}

/**
 * Fetch video data from IO
 */
export async function getPhotoData(
  year: number,
  month: number,
  date: number
): Promise<WrappedResponse<PhotoFile[]>> {
  const dateQuery = formatDateQuery(year, month, date);

  const retriever = async () => {
    let queryParams = `${dateQuery}&as=1&so=7&cols=4`;

    const res = await fetchIO(queryParams, "photoData");

    const { numfound } = res.results.response;
    const callsRequired = Math.ceil(numfound / 500); // 500 results per call limit on IO API

    // create array of photos from first API call
    const photos1: PhotoFile[] = parseIOPhotoResponse(res);

    if (callsRequired <= 1 || process.env.NEXT_PUBLIC_APP_ENV === "local") {
      // If using mock data, just return the first 500 in the mock response
      // Only one API call was needed because we got fewer than 500 results. Just return it.
      return photos1;
    }

    // Construct an array of queryParams, one for each page required to reach numFound from first API call
    let queryParamsArray = [];
    for (let i = 1; i < callsRequired; i++) {
      let startNum = 500 * i + 1;
      queryParams = `${dateQuery}&as=1&so=7&cols=4&sr=${startNum}`;
      queryParamsArray.push(queryParams);
    }

    // create an array of promises for async IO calls
    const promiseArray = queryParamsArray.map(async (queryParams) => await fetchIO(queryParams));

    // Call IO as many times as required in parallel. Waits for all calls to resolve into an array of IO results objects
    const resArray = await Promise.all(promiseArray);

    // Parse out results into array of photo objects

    const additionalPhotosArray: PhotoFile[][] = resArray.map((res) => {
      return parseIOPhotoResponse(res);
    });

    // Turn array of photoFile arays into one enormous photoFile array
    let additionalPhotos: PhotoFile[] = additionalPhotosArray.flat(1);

    // Merge the additional photos with the photos from the first API call and return it
    const photos: PhotoFile[] = [...photos1, ...additionalPhotos];
    return photos;
  };

  return fetchWithCache<PhotoFile[]>(`io/photos/${dateQuery}`, retriever, { cacheAge: 3600 });
}

function parseIOPhotoResponse(res: IOResponse): PhotoFile[] {
  const { docs } = res.results.response;
  const photos: PhotoFile[] = [];

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const metadata = parsePhotoResultMetadata(doc);
    photos.push(metadata);
  }
  return photos;
}

/** Parse the photo result for relevant information */
function parsePhotoResultMetadata(doc: Doc): PhotoFile {
  var ioInfoURL = `${process.env.IO_HOST}/app/info.cfm?pid=${doc.id}`;

  // if we are using mock data, then use a mock photo that is not export restricted
  // this allows dev to continue with VPN off
  const isLocal = process.env.NEXT_PUBLIC_APP_ENV === "local";
  const lowResURL =
    isLocal && process.env.IO_MOCK_MEDIA_URL
      ? process.env.IO_MOCK_MEDIA_URL + "mock_photo1_small.jpg"
      : `${process.env.IO_HOST}${doc.webpath}/lores/${doc.nasa_id}.${doc.file_extension_lores}`;
  const highResURL =
    isLocal && process.env.IO_MOCK_MEDIA_URL
      ? process.env.IO_MOCK_MEDIA_URL + "mock_photo1.jpg"
      : `${process.env.IO_HOST}${doc.webpath}/hires/${doc.nasa_id}.${doc.file_extension_lores}`;

  const photoFile: PhotoFile = {
    id: doc.nasa_id,
    description: doc.description || "",
    lowResURL,
    highResURL,
    ioInfoURL,
    date_added: doc.date_added,
    date_taken: doc.md_creation_date,
    dateTakenAppSeconds: appSecondsFromDateString(doc.md_creation_date),
    collections_string: doc.collections_string[doc.collections_string.length - 1], //last and longest string in the array
    collections_string_pretty: cleanCollectionsString(
      doc.collections_string[doc.collections_string.length - 1]
    ),
  };

  return photoFile;
}

function cleanCollectionsString(colStr) {
  const fullTree = colStr.split("|");

  let cleaned = fullTree[fullTree.length - 1];
  cleaned = cleaned.replace(fullTree[1], "");
  if (fullTree[2]?.includes("Earth Obs")) {
    cleaned = fullTree[2].replace(fullTree[1], "") + " " + cleaned;
  }
  if (cleaned === "Photo") {
    cleaned = fullTree[2].replace(fullTree[1], "");
  }
  return cleaned;
}
