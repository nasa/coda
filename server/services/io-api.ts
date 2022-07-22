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

FYI, s_dt and e_dt don't act like a range apparently. setting s_dt and e_dt to different days means you're literally asking for videos that start on one day and end on another
*/
import { padZeros, appSecondsFromDateString } from "utils/formatting";
import fetchWithCache from "./cache-client";
import fetchWithTimeout from "../../utils/fetch-with-timeout";
import type { Response } from "node-fetch";
import { inRange } from "lodash";
import { add } from "store/playhead";
import { Collection } from "utils/enums";

/** Perform a request against IO with the given parameters */
async function fetchIO(params: string, action?: "photos" | "videos"): Promise<IOResponse> {
  const isLocal = process.env.NEXT_PUBLIC_APP_ENV === "local";

  if (isLocal) {
    if (action === "videos") {
      // we're in the local environment. mock the request
      console.log("Mocking request for getVideoData()");
      let mockIOData: IOResponse = require("/mocks/fakedata/io_videos.json");

      // mock the request with local data
      return await Promise.resolve(mockIOData);
    }

    if (action === "photos") {
      console.log("Mocking request for getPhotoData()");
      const mockIOData: IOResponse = require("/mocks/fakedata/io_photos.json");

      // mock the request with local data
      return await Promise.resolve(mockIOData);
    }
  }

  const url = `${process.env.IO_API_URL}&${params}?key=${process.env.IO_KEY}&format=json`;
  const options = {
    timeout: 8000,
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

/** Format an IO query string for a single day */
function formatDateQuery(start: Date): string {
  const startYear = start.getUTCFullYear();
  const startMonth = start.getUTCMonth() + 1;
  const startDay = start.getUTCDate();
  const rangeStartYear = `${startYear}`;
  const rangeStartMonth = padZeros(startMonth, 2);
  const rangeStartDate = padZeros(startDay, 2);

  let rangeEndYear: string, rangeEndMonth: string, rangeEndDate: string;
  rangeEndYear = rangeStartYear;
  rangeEndMonth = rangeStartMonth;
  rangeEndDate = rangeStartDate;

  const rangeStartIO = `${rangeStartMonth}-${rangeStartDate}-${rangeStartYear}`;
  const rangeEndIO = `${rangeEndMonth}-${rangeEndDate}-${rangeEndYear}`;

  return `s_dt=${rangeStartIO}&e_dt=${rangeEndIO}`;
}

/**
 *
 * @param collection
 * @param dataType either "videos" or "photos"
 * @param requestDate date to fetch data for
 * @returns
 */
export async function fetchData(
  collection: Collection,
  dataType: "photos" | "videos",
  requestDate: Date
) {
  const dateQuery = formatDateQuery(requestDate);
  let parser: (arg0: IOResponse, arg1: Collection) => PhotoFile[] | VideoFile[],
    preferNew: boolean,
    queryParams: string;
  switch (dataType) {
    case "photos":
      parser = parseIOPhotoResponse;
      preferNew = false;
      queryParams = `${dateQuery}&as=1&so=7&cols=${Collection[collection]}`;
      break;
    case "videos":
      const today = new Date().setHours(0, 0, 0, 0);
      parser = parseIOVideoResponse;
      // If we're looking for video older than yesterday than the cache will do just fine (taking into account cacheAge).
      // If we're looking more recent (between start of yesterday and end of today) then definitely pull new data becuase there's a chance it's been updated
      preferNew = inRange(requestDate.getTime(), today, today + 86400000) ? true : false; //86400000 = 24 hours in ms
      queryParams = `${dateQuery}&cols=${Collection[collection]}&as=2`;
      break;
  }

  const retriever = async () => {
    const res = await fetchIO(queryParams, dataType);

    const { numfound } = res.results.response;
    const callsRequired = Math.ceil(numfound / 500); // 500 results per call limit on IO API

    // create array from first API call
    const data1 = parser(res, collection);

    if (callsRequired <= 1 || process.env.NEXT_PUBLIC_APP_ENV === "local") {
      // If using mock data, just return the first 500 in the mock response
      // Only one API call was needed because we got fewer than 500 results. Just return it.
      return data1;
    }

    // Construct an array of queryParams, one for each page required to reach numFound from first API call
    let queryParamsArray: string[] = [];
    for (let i = 1; i < callsRequired; i++) {
      let startNum = 500 * i + 1;
      queryParamsArray.push(`${queryParams}&sr=${startNum}`);
    }

    // create an array of promises for async IO calls
    const promiseArray = queryParamsArray.map(async (queryParams) => await fetchIO(queryParams));

    // Call IO as many times as required in parallel. Waits for all calls to resolve into an array of IO results objects
    const resArray = await Promise.all(promiseArray);

    // Parse out results into array of objects
    const additionalDataArray = resArray.map((res) => {
      return parser(res, collection);
    });

    // Turn array of arrays into one enormous array
    let additionalData = additionalDataArray.flat(1) as PhotoFile[] | VideoFile[];

    // Merge the additional objects with the objects from the first API call and return it
    const allData = [...data1, ...additionalData] as PhotoFile[] | VideoFile[];
    return allData;
  };

  return fetchWithCache<PhotoFile[] | VideoFile[]>(
    `io/${dataType}/${collection}/${dateQuery}`,
    retriever,
    {
      cacheAge: 3600,
      staleOk: true,
      preferNew: preferNew,
    }
  );
}

function parseIOVideoResponse(res: IOResponse, collection: Collection) {
  const { docs } = res.results.response;
  const videos: VideoFile[] = [];

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const metadata = parseVideoResultMetadata(doc, collection);
    videos.push(metadata);
  }
  videos.sort(videoSorter);

  return videos;
}

/**
 * Sorts by priority first, then duration second. This sorting is later used to choose the item with the highest array position for the preferred video stream for a given group and time.
 */
const videoSorter = (a: VideoFile, b: VideoFile) => {
  const aDuration = a.end - a.start;
  const bDuration = b.end - b.start;
  return (
    +(a.priority < b.priority) ||
    +(a.priority === b.priority) ||
    +(aDuration < bDuration) ||
    +(aDuration === bDuration)
  );
};

/** Parse the video result for relevant information */
function parseVideoResultMetadata(doc: Doc, collection: Collection): VideoFile {
  let downlink = -1;
  let LOS = false;

  if (+Collection[collection] === +Collection.ISS) {
    const channel = getChannel(doc.collections_string);

    if (["01", "02", "03", "04", "05", "06", "07", "08"].indexOf(channel) > -1) {
      downlink = parseInt(channel) - 1;
    }
  } else if (+Collection[collection] === +Collection.TEST_EVENTS) {
    //modify downlink numbers for test events based on strings in video title on IO
    if (doc.md_title) {
      if (doc.md_title.includes("EV1")) {
        downlink = 0;
      } else if (doc.md_title.includes("EV2")) {
        downlink = 1;
      } else if (doc.md_title.includes("QUAD")) {
        downlink = 2;
      }
    }
  } else if (+Collection[collection] === +Collection.NBL) {
    // Modify downlink numbers for nbl collection results based on strings in collections list
    // Look through every collection string in the collection_string array. This covers when NBL runs have been added to multiple collections
    for (let i = 0; i < doc.collections_string.length; i++) {
      const thisCollectionsString = doc.collections_string[i];
      if (thisCollectionsString.includes("EV1")) {
        downlink = 0;
      } else if (thisCollectionsString.includes("EV2")) {
        downlink = 1;
      } else if (thisCollectionsString.includes("QUAD")) {
        downlink = 2;
      }
    }
  }

  // Create array of date elements from creation date
  const dateToUse = doc.vmd_start_gmt || doc.md_creation_date;
  let dateArr = dateToUse
    // regex match for the date
    .match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z/)
    // remove the first item (the full matched string)
    .slice(1)
    .map((n: string) => parseInt(n));

  // trust the nasa_id over the md_creation_date
  const id_metadata = doc.nasa_id.match(/iss\d{3}m(\d)(\d)\d+(\d{2})(\d{2})/);
  if (id_metadata && id_metadata[1] === "5") {
    dateArr[3] = +id_metadata[3];
    dateArr[4] = +id_metadata[4];
    dateArr[5] = 0;
    LOS = true;
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
  const duration_ms = (doc.duration_seconds || 0) * 1000;
  const UTCend = new Date(UTCstartMilliseconds + duration_ms);

  var dataURL = `${process.env.IO_HOST}/app/info.cfm?pid=${doc.id}`;

  // if we are using mock data, then stream a mock video file in place of all video files
  // this allows dev to continue with VPN off
  const isLocal = process.env.NEXT_PUBLIC_APP_ENV === "local";
  const mediaLowResURL =
    isLocal && process.env.IO_MOCK_MEDIA_URL
      ? process.env.IO_MOCK_MEDIA_URL + "mock_video_lq.mp4"
      : `${process.env.IO_HOST}${doc.webpath}/video/${doc.nasa_id}.${doc.file_extension_video}`;

  const videoFile: VideoFile = {
    id: doc.nasa_id,
    title: doc.md_title || "",
    description: doc.description || "",
    start: UTCstartMilliseconds / 1000,
    end: UTCend.valueOf() / 1000,
    dataURL,
    mediaLowResURL,
    LOS,
    priority: LOS ? 0 : 1,
    startDateTime: "",
    downlink,
    collection,
    // last and longest string in the array
    collections: doc.collections_string[doc.collections_string.length - 1],
  };

  /*
   Make the start time the vmd_start_gmt if it exists, otherwise use md_creation_date.
   md_creation_date is actually the video start time for all ISS video, not the IO creation date
   */
  videoFile.startDateTime = doc.vmd_start_gmt || doc.md_creation_date;
  ``;

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

function parseIOPhotoResponse(res: IOResponse, collection: Collection): PhotoFile[] {
  const { docs } = res.results.response;
  const photos: PhotoFile[] = [];

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const metadata = parsePhotoResultMetadata(doc, collection);
    photos.push(metadata);
  }
  return photos;
}

/** Parse the photo result for relevant information */
function parsePhotoResultMetadata(doc: Doc, collection: Collection): PhotoFile {
  var dataURL = `${process.env.IO_HOST}/app/info.cfm?pid=${doc.id}`;

  // if we are using mock data, then use a mock photo that is not export restricted
  // this allows dev to continue with VPN off
  const isLocal = process.env.NEXT_PUBLIC_APP_ENV === "local";
  const mediaLowResURL =
    isLocal && process.env.IO_MOCK_MEDIA_URL
      ? process.env.IO_MOCK_MEDIA_URL + "mock_photo1_small.jpg"
      : `${process.env.IO_HOST}${doc.webpath}/lores/${doc.nasa_id}.${doc.file_extension_lores}`;
  const mediaHighResURL =
    isLocal && process.env.IO_MOCK_MEDIA_URL
      ? process.env.IO_MOCK_MEDIA_URL + "mock_photo1.jpg"
      : `${process.env.IO_HOST}${doc.webpath}/hires/${doc.nasa_id}.${doc.file_extension_lores}`;
  const mediaThumbURL =
    isLocal && process.env.IO_MOCK_MEDIA_URL
      ? process.env.IO_MOCK_MEDIA_URL + "mock_photo1.jpg"
      : `${process.env.IO_HOST}${doc.webpath}/thumb/${doc.nasa_id}.${doc.file_extension_lores}`;

  const photoFile: PhotoFile = {
    id: doc.nasa_id,
    description: doc.description || "",
    mediaLowResURL,
    mediaHighResURL,
    mediaThumbURL,
    dataURL,
    dateAdded: doc.date_added,
    datetimeTaken: doc.md_creation_date,
    datetimeTakenAppSeconds: appSecondsFromDateString(doc.md_creation_date),
    collection,
    // last and longest string in the array
    collections: doc.collections_string[doc.collections_string.length - 1],
  };

  return photoFile;
}
