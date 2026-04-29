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
import fetchWithTimeout from "../../utils/fetch-with-timeout";
import isNil from "lodash/isNil";
import { collection } from "utils/consts";
import { addMs } from "../../utils/date";
import ConsoleLogger from "utils/logging/consoleLogger";

const IO_HOST = "https://io.jsc.nasa.gov";
const IO_API_URL = `${IO_HOST}/api/search/rpp=500`;

/**
 * Perform a request against the Imagery Online (IO) API with the given parameters.
 * @param params - URL query parameters (e.g., "s_dt=01-01-2020&e_dt=01-02-2020")
 * @returns Promise resolving to IO API response with docs array
 */
async function fetchIO(params: string): Promise<IOResponse> {
  const url = `${IO_API_URL}&${params}?key=${process.env.IO_KEY}&format=json`;
  const options = {
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Accept-Encoding": "gzip,deflate,br",
      "Accept-Language": "en-US,en;q=0.9",
      Connection: "keep-alive",
      Origin: process.env.HOST,
    },
  };

  try {
    const res = await fetchWithTimeout(url, options);
    return res.json();
  } catch (e) {
    ConsoleLogger.error("Error fetching IO data", e);
    throw e; // Re-throw to allow caller to handle the error
  }
}

/** Fetch an override manifest for video, photo, or transcript sources. */
export async function fetchForgedIoManifest(
  override: MediaOverride
): Promise<VideoFile[] | PhotoFile[]> {
  const dataPath = `${override.url}/${override.type}Manifest.json`;

  const res = await fetchWithTimeout(dataPath);
  return res.json() as Promise<VideoFile[] | PhotoFile[]>;
}

/**
 * Format an IO API date query string for a date range.
 * IO API expects dates in MM-DD-YYYY format.
 * Note: IO API treats s_dt and e_dt as exact match filters (not a true range),
 * so videos must start on s_dt and end on e_dt.
 * Exported for testing purposes.
 * @param start - Start date for the query
 * @param end - Optional end date. If omitted, uses start date (single day query)
 * @returns Query string like "s_dt=01-30-2020&e_dt=01-30-2020"
 */
export function formatDateQuery(start: Date, end?: Date): string {
  const formatDate = (d: Date): string => {
    const month = padZeros(d.getUTCMonth() + 1, 2);
    const day = padZeros(d.getUTCDate(), 2);
    const year = d.getUTCFullYear();
    return `${month}-${day}-${year}`;
  };

  const rangeStartIO = formatDate(start);
  const rangeEndIO = isNil(end) ? rangeStartIO : formatDate(end);

  return `s_dt=${rangeStartIO}&e_dt=${rangeEndIO}`;
}

/**
 * Fetch for either photo or video data from the IO API.
 * @param collection Collection ID used to build the IO query string
 * @param fetchType IOFetchType
 * @param requestedDate The date to fetch data for
 * @param channelOverrideMap Optional per-asset channel override map (videos only)
 * @returns PhotoFile[] | VideoFile[]
 */
export async function fetchIoData({
  collection,
  fetchType,
  requestedDate,
  channelOverrideMap,
}: {
  collection: Collection;
  fetchType: IOFetchType;
  requestedDate: Date;
  channelOverrideMap?: Record<string, number>;
}): Promise<PhotoFile[] | VideoFile[]> {
  let parser: (arg0: IOResponse, arg1: Collection) => PhotoFile[] | VideoFile[];
  let queryParams: string;

  if (fetchType === "photos") {
    parser = parseIOPhotoResponse;
    const dateQuery = formatDateQuery(requestedDate);
    queryParams = `${dateQuery}&as=1&so=7&cols=${collection}`;
  } else if (fetchType === "videos") {
    parser = (res, col) => parseIOVideoResponse(res, col, channelOverrideMap);
    const dateQuery = formatDateQuery(addMs(requestedDate, -86400000), requestedDate); // get video for requestDate and also one day before to catch any vids crossing midnight
    queryParams = `${dateQuery}&cols=${collection}&as=2`;
  } else {
    throw new Error(`Unsupported IO fetch type: ${fetchType}`);
  }

  const initialResponse = await fetchIO(queryParams);
  const limit = 500; // limit on results per call for IO API
  if (!initialResponse.results) {
    return [];
  }
  const { numfound } = initialResponse.results.response;
  const callsRequired = Math.ceil(numfound / limit);

  // create array from first API call
  const data1 = parser(initialResponse, collection);

  // Construct an array of queryParams, one for each page required to reach numFound from first API call
  const queryParamsArray: string[] = buildQueryArray(queryParams, callsRequired, limit);

  // create an array of promises for async IO calls
  const promiseArray = queryParamsArray.map(async (queryParams) => await fetchIO(queryParams));

  // Call IO as many times as required in parallel. Waits for all calls to resolve into an array of IO results objects
  const resArray = await Promise.all(promiseArray);

  // Parse out results into array of objects
  const additionalDataArray = resArray.map((res) => {
    return parser(res, collection);
  });

  // Turn array of arrays into one enormous array
  const additionalData = additionalDataArray.flat(1) as PhotoFile[] | VideoFile[];

  // Merge the additional objects with the objects from the first API call and return it
  const allData = [...data1, ...additionalData] as PhotoFile[] | VideoFile[];
  return allData;
}

/**
 * Builds a string array of URL parameters for paginated IO API calls.
 * The first call (page 0) is made separately, so this builds query strings for pages 1 through N-1.
 * Each subsequent page uses the "sr" (start record) parameter to offset into the result set.
 * Exported for unit testing.
 * @param queryParams - Base query parameter string to prepend (e.g., "s_dt=01-01-2020&as=2")
 * @param callsRequired - Total number of API calls needed to retrieve all records
 * @param limit - Maximum records returned per API call (IO API limit is 500)
 * @returns Array of query strings, one per additional page needed (excludes first page)
 */
export function buildQueryArray(
  queryParams: string,
  callsRequired: number,
  limit: number
): string[] {
  const queryParamsArray: string[] = [];
  for (let i = 1; i < callsRequired; i++) {
    const startNum = limit * i + 1;
    queryParamsArray.push(`${queryParams}&sr=${startNum}`);
  }
  return queryParamsArray;
}

function parseIOVideoResponse(
  res: IOResponse,
  collection: Collection,
  channelOverrideMap?: Record<string, number>
) {
  if (!res.results) {
    return [];
  }
  const { docs } = res.results.response;
  const videos: VideoFile[] = [];

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const metadata = parseVideoResultMetadata(doc, collection, channelOverrideMap);
    videos.push(metadata);
  }
  videos.sort(videoSorter);

  return videos;
}

/**
 * Sort comparator for video files: prioritizes by priority value (lower is better), then by duration (longer is better).
 * This sorting is used to select the preferred video stream when multiple videos exist for the same time period.
 * Priority 0 = LOS (Loss of Signal) recorded video, Priority 1 = realtime downlink.
 * Longer videos are preferred when priority is equal (more continuous coverage).
 * Exported for testing.
 * @returns Negative if a comes first, positive if b comes first, 0 if equal
 */
export const videoSorter = (a: VideoFile, b: VideoFile): number => {
  const aDuration = a.end - a.start;
  const bDuration = b.end - b.start;
  // Standard sort comparator: <0 sorts a before b, >0 sorts a after b, 0 keeps original order
  return a.priority - b.priority || bDuration - aDuration;
};

/**
 * Parse a video document from IO API response into a VideoFile object.
 * Extracts metadata including downlink channel, start/end times, and media URLs.
 * @param doc - Raw video document from IO API response
 * @param col - Collection ID to determine how to parse downlink information
 * @returns Parsed VideoFile object ready for application use
 */
function parseVideoResultMetadata(
  doc: Doc,
  col: Collection,
  channelOverrideMap?: Record<string, number>
): VideoFile {
  let downlink = -1; // -1 indicates no specific downlink channel
  let LOS = false; // LOS (Loss of Signal) = video recorded during communication blackout, downlinked later

  // Only assign downlink channel if this is actually a downlink video (based on NASA ID source code)
  // Non-downlink videos (onboards, NASA TV, HDEV, etc.) will remain with downlink=-1
  // so they appear in the "Video Non-Downlink" component
  const videoIsDownlink = isDownlinkVideo(doc.nasa_id);

  // Determine downlink channel based on collection type
  // Different collections store channel information in different metadata fields
  if (videoIsDownlink && col === collection.ISS) {
    const channel = getISSChannel(doc.collections_string);
    // ISS has 8 downlink channels (01-08), convert to 0-indexed
    if (["01", "02", "03", "04", "05", "06", "07", "08"].indexOf(channel) > -1) {
      downlink = parseInt(channel) - 1;
    }
  } else if (col === +collection.TEST_EVENTS) {
    // For test events, downlink channel is encoded in the video title
    // EV1 = EVA crew member 1, EV2 = EVA crew member 2, QUAD = multi-view
    if (doc.md_title) {
      if (doc.md_title.includes("EV1")) {
        downlink = 0;
      } else if (doc.md_title.includes("EV2")) {
        downlink = 1;
      } else if (doc.md_title.includes("QUAD")) {
        downlink = 2;
      }
    }
  } else if (col === collection.NBL) {
    // For NBL (Neutral Buoyancy Lab), check all collection strings
    // Videos may be added to multiple collections, need to check all to find crew member assignment
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
  } else if (col === collection.ARTEMIS) {
    // Artemis missions use collection strings, source codes, and per-asset overrides
    const channel = getArtemisChannel(doc.collections_string, doc.nasa_id, channelOverrideMap);
    downlink = channel !== "" ? parseInt(channel) - 1 : -1;
  } else if (col === collection.ARTEMIS_TRAINING) {
    // Artemis (Training) uses the same channel-parsing strategy as ARTEMIS
    const channel = getArtemisChannel(doc.collections_string, doc.nasa_id, channelOverrideMap);
    downlink = channel !== "" ? parseInt(channel) - 1 : -1;
  }

  // Determine video start time from IO metadata
  // Prefer vmd_start_gmt (manually corrected start time) over md_creation_date
  const dateToUse = doc.vmd_start_gmt || doc.md_creation_date;

  // Parse ISO 8601 timestamp (YYYY-MM-DDTHH:MM:SSZ)
  const dateMatch = dateToUse.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z/);
  if (!dateMatch) {
    throw new Error(`Invalid date format: ${dateToUse}`);
  }
  const dateArr = dateMatch
    .slice(1) // Remove full match, keep only capture groups
    .map((n: string) => parseInt(n));

  // For LOS videos, nasa_id contains the actual start time, not md_creation_date
  // nasa_id format: iss<exp>m<realtime><downlink><day><time>
  // Example: iss060m532331624 = Exp 60, recorded during LOS (5), downlink 3 (after delay), day 278, time 1939 UTC
  // When middle digit is "5", it indicates LOS recording (vs "0-4" for realtime)
  const id_metadata = doc.nasa_id.match(/iss\d{3}m(\d)(\d)\d+(\d{2})(\d{2})/);
  if (id_metadata && id_metadata[1] === "5") {
    // Extract actual start time from nasa_id instead of using md_creation_date
    dateArr[3] = +id_metadata[3]; // Hour
    dateArr[4] = +id_metadata[4]; // Minute
    dateArr[5] = 0; // Seconds (not encoded in nasa_id)
    LOS = true;
  }

  // Create UTC timestamp. Note: JavaScript months are 0-indexed (0=January, 11=December)
  const UTCstartMilliseconds = Date.UTC(
    dateArr[0], // Year
    dateArr[1] - 1, // Month (convert from 1-indexed to 0-indexed)
    dateArr[2], // Day
    dateArr[3], // Hour
    dateArr[4], // Minute
    dateArr[5] // Second
  );
  const duration_ms = (doc.duration_seconds || 0) * 1000;
  const UTCend = new Date(UTCstartMilliseconds + duration_ms);

  const dataURL = `${IO_HOST}/app/info.cfm?pid=${doc.id}`;

  const mediaLowResURL = `${IO_HOST}${doc.webpath}/video/${doc.nasa_id}.${doc.file_extension_video}`;

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
    collection: col,
    // last and longest string in the array
    collections: doc.collections_string[doc.collections_string.length - 1],
  };

  // Use vmd_start_gmt (manually corrected start time) if available, otherwise use md_creation_date.
  // Note: Despite the name, md_creation_date is the video start time, not the IO database creation date.
  videoFile.startDateTime = doc.vmd_start_gmt || doc.md_creation_date;

  return videoFile;
}

/**
 * Determine if a video is a downlink video based on its NASA ID.
 * NASA ID format: iss<exp>m<source><day><time> or sts<mission>m<source><day><time>
 * Where <source> is the 2-digit video source number:
 * - 01-10: SD Downlink
 * - 11-20: HD Downlink
 * - 31: Russian Downlink
 * - 60: Shuttle Downlink
 * All other source IDs are non-downlink (onboards, NASA TV, GVS, etc.)
 * Exported for testing purposes.
 * @param nasaId - NASA ID string from IO API doc
 * @returns true if the video is a downlink video, false otherwise
 */
export function isDownlinkVideo(nasaId: string): boolean {
  // Match ISS or STS video ID format: (iss|sts)<exp>m<source><day><time>
  // exp = mission/expedition number (3 digits)
  // m = moving imagery marker (literal 'm')
  // source = video source number (2 digits)
  const match = nasaId.match(/^(?:iss|sts)(\d{3})m(\d{2})/i);
  if (!match) {
    // If the ID doesn't match the expected format, exclude it to be safe
    return false;
  }

  const sourceId = parseInt(match[2], 10);

  // Downlink source IDs per NASA spec:
  // 01-10: SD Downlink
  // 11-20: HD Downlink
  // 31: Russian Downlink
  // 60: Shuttle Downlink
  // Note: 51-59 is GVS SD Video per spec, NOT downlink
  return (
    (sourceId >= 1 && sourceId <= 10) ||
    (sourceId >= 11 && sourceId <= 20) ||
    sourceId === 31 ||
    sourceId === 60
  );
}

/**
 * Extract ISS downlink channel number from IO API collection strings.
 * IO stores channel info in hierarchical collection paths like:
 * "ISS Missions|ISS-060|Video|US Downlink|Channel 03"
 * Exported for testing purposes.
 * @param collectionStrings - Array of collection path strings from IO API doc
 * @returns Zero-padded channel number ("01"-"08") or empty string if no channel found
 */
export function getISSChannel(collectionStrings: string[]): string {
  for (const collectionStr of collectionStrings) {
    const chMatch = collectionStr.match(/US Downlink\|Channel (\d+)/);
    if (chMatch) {
      return padZeros(parseInt(chMatch[1]), 2);
    }
  }
  return "";
}

/**
 * Extract Artemis mission CODA channel number from IO API metadata.
 *
 * Uses a three-tier strategy:
 * 1. **Per-asset overrides** – A nasa_id → channel map sourced from the
 *    asset_override_db table (mediaType="video"). Covers recovery-phase
 *    source-150 feeds (Quad, Helo, SCIFLI, WB-57) that share a source code but
 *    represent different camera angles.
 * 2. **Collection string** – If the path contains `Downlink|Channel XX`, extract
 *    the channel number directly (channels 01-04).
 * 3. **Source code fallback** – Parse the 3-digit source code from the nasa_id
 *    (`art{mission}m{source}...`) and map:
 *      101-104 → channels 01-04 (downlink channels, including Prelaunch/Launch)
 *      150     → channel 05 (NASA TV / broadcast)
 *      120     → channel 06 (onboard camera clips)
 *      136-138 → channel 07 (FCR cameras)
 *
 * See src/server/processing/artemis2/README.md for full rationale.
 * Exported for testing purposes.
 *
 * @param collectionStrings - Array of collection path strings from IO API doc
 * @param nasaId - The nasa_id field from the IO API doc
 * @param channelOverrideMap - Optional per-asset override map keyed by nasa_id
 * @returns Zero-padded channel number ("01"-"08") or empty string if unmapped
 */
export function getArtemisChannel(
  collectionStrings: string[],
  nasaId: string,
  channelOverrideMap?: Record<string, number>
): string {
  // 1. Per-asset override map. Caller supplies the map scoped to the request's
  // mediaType + source + date range; an empty map (or undefined) skips this tier.
  if (channelOverrideMap) {
    const override = channelOverrideMap[nasaId];
    if (override !== undefined) {
      return padZeros(override, 2);
    }
  }

  // 2. Explicit channel from collection_string (Downlink|Channel XX)
  for (const collectionStr of collectionStrings) {
    const chMatch = collectionStr.match(/Downlink\|Channel (\d+)/);
    if (chMatch) {
      return padZeros(parseInt(chMatch[1]), 2);
    }
  }

  // 3. Source code fallback from nasa_id (art{mission}m{source}{day}{time})
  const srcMatch = nasaId.match(/^art\d{3}m(\d{3})/);
  if (srcMatch) {
    const sourceCode = parseInt(srcMatch[1], 10);
    if (sourceCode >= 101 && sourceCode <= 104) {
      return padZeros(sourceCode - 100, 2); // 101→01, 102→02, etc.
    }
    if (sourceCode === 150) return padZeros(5, 2); // NASA TV
    if (sourceCode === 120) return padZeros(6, 2); // Onboard cameras
    if (sourceCode >= 136 && sourceCode <= 138) return padZeros(7, 2); // FCR cameras
  }

  return "";
}

function parseIOPhotoResponse(res: IOResponse, collection: Collection): PhotoFile[] {
  if (!res.results) {
    return [];
  }
  const { docs } = res.results.response;
  const photos: PhotoFile[] = [];

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const metadata = parsePhotoResultMetadata(doc, collection);
    photos.push(metadata);
  }
  return photos;
}

/**
 * Parse a photo document from IO API response into a PhotoFile object.
 * Extracts metadata and constructs URLs for thumbnail, low-res, and high-res versions.
 * @param doc - Raw photo document from IO API response
 * @param collection - Collection ID for categorization
 * @returns Parsed PhotoFile object ready for application use
 */
function parsePhotoResultMetadata(doc: Doc, collection: Collection): PhotoFile {
  const dataURL = `${IO_HOST}/app/info.cfm?pid=${doc.id}`;

  const mediaLowResURL = `${IO_HOST}${doc.webpath}/lores/${doc.nasa_id}.${doc.file_extension_lores}`;
  const mediaHighResURL = `${IO_HOST}${doc.webpath}/hires/${doc.nasa_id}.${doc.file_extension_lores}`;
  const mediaThumbURL = `${IO_HOST}${doc.webpath}/thumb/${doc.nasa_id}.${doc.file_extension_lores}`;

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
