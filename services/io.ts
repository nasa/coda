/*
Methods for fetching from Imagery Online (IO)
*/
import fetch from "isomorphic-unfetch";
import { assignStartEnd, generateTimingData } from "store/videos";
import { padZeros, secondsIntoDayFromZuluDateString } from "utils/formatting";

if (typeof window === "undefined") {
  // IO uses a NOCA cert. We need to tell Node to use system certs on Mac and Windows. Node on Linux uses system certs by default. see the discussion/complaints here https://github.com/nodejs/node/issues/3159#issuecomment-477295118
  require("mac-ca");
  require("win-ca");
}

let mockIOData: IOResponse;
if (process.env.NEXT_PUBLIC_APP_ENV === "local") {
  // get mock data for later
  mockIOData = require("../mocks/fakedata/io.json");
}

/**
 * Response from a search on Imagery Online
 */
type IOResponse = {
  results: {
    responseheader: any;
    facet_counts: any;
    response: {
      start: number;
      /** Info about videos from the search */
      docs: Doc[];
      numfound: number;
    };
  };
};

/** Represents a single video search result as received from IO */
type Doc = {
  audio_file_restricted: 0 | 1 | number;
  hh: 0 | 1 | number;
  duration_seconds: number;
  on_public_site: number;
  tw: number;
  md_online_01: number;
  on_flickr: 0 | 1 | number;
  lw: number;
  hw: number;
  /** Title of the EVA, eg. `US EVA 55` */
  md_title?: string;
  description?: string;
  md_orbit_ground: number;
  has_audio_file: 0 | 1 | number;
  asset_type: number;
  /** eg. `mp4` - just the extension, no leading dot */
  file_extension_video: string;
  /** eg. `iss060m532` */
  nasa_prefix?: string;
  /**
   * eg. `iss060m532331624`. There is an exception for video recorded during LOS
   * Breakdown:
   * ```md
   * iss  = ISS video
   * 053  = Expedition 53
   * m    = moving imagery e.g. video
   * 53   = Downlink 3, downlinked after an LOS. Realtime downlink would be 03
   * 278  = GMT day 278
   * 1939 = Actual start time of the video
   * ```
   *
   * Note that 19:39 is the actual GMT start time of this video for a non-realtime
   * downlink. The "Start GMT" listed in IO is wrong, stating GMT 0600.
   * */
  nasa_id: string;
  /** eg. `/photos/vrps/12674` */
  webpath: string;
  id: number;
  metadata_template: number;
  /** The suffix is found at the end of .nasa_id, eg. `331624` */
  nasa_suffix?: number;
  /** eg. `jpg` - just the extension, no leading dot */
  file_extension_lores: string;
  /** eg. `["P2344036/ISS Missions|ISS-060|Video|US Downlink|Channel 03"]` */
  collections_string: string[];
  avg_rating: number;
  collections: (string | number)[];
  file_extension_thum: string;
  /** UTC eg. `2019-08-21T14:47:22Z` */
  date_added: string;
  flickr_photo_id: number;
  th: number;
  collections_list: (string | number)[];
  /** UTC eg. `2019-08-21T17:11:12Z` */
  md_creation_date: string;
  lh: number;
  md_interior_exterior: number;
  _version_: number;
};

/** Parsed metadata from an IO video file result. Each video file belongs to a group. Users select groups, we figure out which file should be playing for the group. Note that there may be overlap between files for each group, eg. 1+ file(s) may have the exact same video from the exact same source but with different start and end times */
export interface VideoFile {
  id: string;
  content: string;
  description: string;
  start: string;
  end: string;
  url: string;
  videoURL: string;
  className: string;
  priority: number;
  md_creation_date: string;
  /** Collection that this file falls under */
  group: number;
  durationSeconds?: number;
  missionSecondsStart?: number;
  missionSecondsEnd?: number;
}

/** Keyed by @see {VideoFile.id} */
export interface Videos {
  [key: string]: VideoFile;
}

/** Parsed metadata from an IO photo file result */
export interface PhotoFile {
  id: string;
  description: string;
  lowResURL: string;
  highResURL: string;
  ioInfoURL: string;
  date_added: string;
  date_taken: string;
  dateTakenAppSeconds: number;
}

export interface Photos {
  [key: string]: PhotoFile;
}

/** Perform a request against IO with the given parameters */
async function fetchIO(params: string): Promise<IOResponse> {
  if (process.env.NEXT_PUBLIC_APP_ENV === "local") {
    // mock the request with local data
    return Promise.resolve(mockIOData);
  }

  let url = `${process.env.IO_API_URL}&${params}?key=${process.env.NEXT_PUBLIC_IO_KEY}&format=json`;
  // IO doesn't currently like our Origin and key so we need to use a proxy
  url = `${process.env.IO_PROXY_ORIGIN}/coda_server/getio.php?IOParam=${encodeURIComponent(url)}`;

  const options = {
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Accept-Encoding": "gzip,deflate,br",
      "Accept-Language": "en-US,en;q=0.9",
      Connection: "keep-alive",
      Origin: "https://coda-dev.fit.nasa.gov",
    },
  };

  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (e) {
    throw e;
  }
  return res.json();
}

/**
 * Fetch video data from IO
 */
export async function getVideoData(year: number, month: number, date: number): Promise<Videos> {
  const rangeStartYear = year;
  const rangeStartMonth = padZeros(month, 2);
  const rangeStartDate = padZeros(date, 2);
  const rangeEndYear = year;
  const rangeEndMonth = padZeros(month, 2);
  const rangeEndDate = padZeros(date, 2);

  const rangeStartIO = `${rangeStartMonth}-${rangeStartDate}-${rangeStartYear}`;
  const rangeEndIO = `${rangeEndMonth}-${rangeEndDate}-${rangeEndYear}`;
  /* s_dt - start date
   * e_dt - end date
   * as=2 - filetype: video
   */
  const queryParams = `s_dt=${rangeStartIO}&e_dt=${rangeEndIO}&as=2`;

  const res = await fetchIO(queryParams);
  return parseIOVideoResponse(res);
}

function parseIOVideoResponse(res: IOResponse) {
  const { docs } = res.results.response;
  const videos: Videos = {};

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const metadata = parseVideoResultMetadata(doc, i);
    videos[metadata.id] = metadata;
  }

  return videos;
}

/** Parse the video result for relevant information */
function parseVideoResultMetadata(doc: Doc, i: number): VideoFile {
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

  // if we are using mock data, then stream the videos from our govcloud clone of IO videos
  // this allows dev to continue with VPN off
  const webpath = process.env.IO_MOCK_WEBPATH ? process.env.IO_MOCK_WEBPATH : doc.webpath;

  const videoURL = `${process.env.IO_HOST}${webpath}/video/${doc.nasa_id}.${doc.file_extension_video}`;

  return {
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
  };
}

/**
 * Pull a channel from the IO response of available channels. Exported for testing purposes.
 */
export function getChannel(collectionStrings: string[]): string {
  for (let j = 0; j < collectionStrings.length; j++) {
    const chMatch = collectionStrings[j].match(/US Downlink\|Channel (\d+)/);

    if (chMatch) {
      return chMatch[1];
    }
  }
  return "";
}

/**
 * Fetch video data from IO
 */
export async function getPhotoData(year: number, month: number, date: number): Promise<Photos> {
  const rangeStartYear = year;
  const rangeStartMonth = padZeros(month, 2);
  const rangeStartDate = padZeros(date, 2);
  const rangeEndYear = year;
  const rangeEndMonth = padZeros(month, 2);
  const rangeEndDate = padZeros(date, 2);

  const rangeStartIO = `${rangeStartMonth}-${rangeStartDate}-${rangeStartYear}`;
  const rangeEndIO = `${rangeEndMonth}-${rangeEndDate}-${rangeEndYear}`;
  /* s_dt - start date
   * e_dt - end date
   * as=1 - filetype: photo
   * so=7 - sort oldest date taken first
   * go=0 - 0 - No filter (default) 1 - Ground-based imagery 2 - On-orbit imagery (IO metadata doesn't seem to support this)
   * ie=0 - 0 - No filter (default) 1 - Interior imagery 2 - Exterior imagery (IO metadata doesn't seem to support this)
   * cols=4 - 4 - ISS Missions. Full list https://io.jsc.nasa.gov/api/search
   */
  let queryParams = `s_dt=${rangeStartIO}&e_dt=${rangeEndIO}&as=1&so=7&cols=4`;

  let res = await fetchIO(queryParams);
  const { numfound } = res.results.response;
  const callsRequired = Math.ceil(numfound / 500); // 500 results per call limit on IO API

  // create array of photos from first API call
  const photos1: { [key: string]: PhotoFile } = parseIOPhotoResponse(res);

  if (callsRequired <= 1) {
    // Only one API call was needed because we got fewer than 500 results. Just return it.
    return photos1;
  }
  // Construct an array of queryParams, one for each page required to reach numFound from first API call
  let queryParamsArray = [];
  for (let i = 1; i < callsRequired; i++) {
    let startNum = 500 * i + 1;
    queryParams = `s_dt=${rangeStartIO}&e_dt=${rangeEndIO}&as=1&so=7&cols=4&sr=${startNum}`;
    queryParamsArray.push(queryParams);
  }

  // create an array of promises for async IO calls
  const promiseArray = queryParamsArray.map(async (queryParams) => {
    return await fetchIO(queryParams);
  });

  // Call IO as many times as required in parallel. Waits for all calls to resolve into an array of IO results objects
  const resArray = await Promise.all(promiseArray);

  // Parse out results into array of photo objects
  const additionalPhotosArray: Photos[] = resArray.map((res) => {
    return parseIOPhotoResponse(res);
  });

  // Turn array of photo objects into one enormous photo object
  let additionalPhotos: Photos = Object.assign({}, ...additionalPhotosArray);

  // Merge the additional photos with the photos from the first API call and return it
  const photos: { [key: string]: PhotoFile } = {
    ...photos1,
    ...additionalPhotos,
  };
  return photos;
}

function parseIOPhotoResponse(res: IOResponse) {
  const { docs } = res.results.response;
  const photos: Photos = {};

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const metadata = parsePhotoResultMetadata(doc, i);
    photos[metadata.id] = metadata;
  }

  return photos;
}

/** Parse the photo result for relevant information */
function parsePhotoResultMetadata(doc: Doc, i: number): PhotoFile {
  var ioInfoURL = `${process.env.IO_HOST}/app/info.cfm?pid=${doc.id}`;

  // if we are using mock data, then stream the videos from our govcloud clone of IO videos
  // this allows dev to continue with VPN off
  const webpath = process.env.IO_MOCK_WEBPATH ? process.env.IO_MOCK_WEBPATH : doc.webpath;
  const lowResURL = `${process.env.IO_HOST}${webpath}/lores/${doc.nasa_id}.${doc.file_extension_lores}`;
  const highResURL = `${process.env.IO_HOST}${webpath}/hires/${doc.nasa_id}.${doc.file_extension_lores}`;

  return {
    id: doc.nasa_id,
    description: doc.description || "",
    lowResURL,
    highResURL,
    ioInfoURL,
    date_added: doc.date_added,
    date_taken: doc.md_creation_date,
    dateTakenAppSeconds: secondsIntoDayFromZuluDateString(doc.md_creation_date),
  };
}

/**
 * Fetch and format all videos for passing to the redux store
 */
export async function buildVideoStore(
  year: number,
  month: number,
  date: number
): Promise<{ [key: string]: VideoFile }> {
  let videos = await getVideoData(year, month, date);
  const timingData = generateTimingData(videos);
  videos = assignStartEnd(videos, timingData);
  return videos;
}

/**
 * Fetch and format all photos for passing to the redux store
 */
export async function buildPhotoStore(
  year: number,
  month: number,
  date: number
): Promise<{ [key: string]: PhotoFile }> {
  let photos = await getPhotoData(year, month, date);
  return photos;
}
