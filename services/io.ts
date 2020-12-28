/*
SERVER ONLY methods for fetching from Imagery Online (IO). Only use this code within `getStaticProps()` or `getServerSideProps()` functions
*/
import fetch, { Response } from "node-fetch";

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
  audio_file_restricted: 0 | 1;
  hh: 0 | 1;
  duration_seconds: number;
  on_public_site: number;
  tw: number;
  md_online_01: number;
  on_flickr: 0 | 1;
  lw: number;
  hw: number;
  /** Title of the EVA, eg. `US EVA 55` */
  md_title: string;
  description: string;
  md_orbit_ground: number;
  has_audio_file: 0 | 1;
  asset_type: number;
  /** eg. `mp4` - just the extension, no leading dot */
  file_extension_video: string;
  /** eg. `iss060m532` */
  nasa_prefix: string;
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
  nasa_suffix: number;
  /** eg. `jpg` - just the extension, no leading dot */
  file_extension_lores: string;
  /** eg. `["P2344036/ISS Missions|ISS-060|Video|US Downlink|Channel 03"]` */
  collections_string: string[];
  avg_rating: number;
  collections: number[];
  file_extension_thum: string;
  /** UTC eg. `2019-08-21T14:47:22Z` */
  date_added: string;
  flickr_photo_id: number;
  th: number;
  collections_list: number[];
  /** UTC eg. `2019-08-21T17:11:12Z` */
  md_creation_date: string;
  lh: number;
  md_interior_exterior: number;
  _version_: number;
};

/** Parsed metadata from an IO video result */
export type VideoItem = {
  id: string;
  content: string;
  description: string;
  start: Date;
  end: Date;
  url: string;
  videoUrl: string;
  className: string;
  priority: number;
  md_creation_date: string;
  group: number;
  durationSeconds?: number;
  missionSecondsStart?: number;
  missionSecondsEnd?: number;
};

export interface Videos {
  [key: string]: VideoItem;
}

/** High level information about the start and end of videos for an EVA */
export interface TimingData {
  video_earliestStart?: Date;
  video_latestEnd?: Date;
  EVA_duration_seconds?: number;
}

/**
 * Nested as:
 *
 * ```md
 *    [ every second
 *      [ every group
 *          [ ID of every video that's playing ]
 *      ]
 *    ]
 * ``` */
export type VideoActivity = number[][][];

/** Perform a request against IO with the given parameters */
async function fetchIO(params: string): Promise<IOResponse> {
  const url = `${process.env.IO_API_URL}&${params}`;
  const options = {
    headers: {
      "Accept-Encoding": "gzip,deflate",
      "Accept-Language": "en-us",
      cacert: process.env.CA_CERT,
      Connection: "keep-alive",
      "Content-Type": "application/json; charset=utf-8",
      cookie: process.env.COOKIE_JAR,
      "cookie-jar": process.env.COOKIE_JAR,
      "Script-Charset": "utf-8",
      "X-SKIP-SAML": "True",
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
export default async function getVideoData(
  year: number,
  month: number,
  day: number
): Promise<Videos> {
  const rangeStartYear = year;
  const rangeStartMonth = month;
  const rangeStartDay = day;
  const rangeEndYear = year;
  const rangeEndMonth = month;
  const rangeEndDay = day;

  const rangeStartIO = `${rangeStartMonth}-${rangeStartDay}-${rangeStartYear}`;
  const rangeEndIO = `${rangeEndMonth}-${rangeEndDay}-${rangeEndYear}`;

  const queryParams = `s_dt=${rangeStartIO}&e_dt=${rangeEndIO}&as=2?key=${process.env.IO_KEY}&format=json`;

  const res = await fetchIO(queryParams);
  return parseIOResponse(res);
}

function parseIOResponse(res: IOResponse) {
  const { docs } = res.results.response;
  const videos: Videos = {};

  let gTimingData: TimingData = {
    video_earliestStart: null,
    video_latestEnd: null,
    EVA_duration_seconds: -1,
  };

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const metadata = parseResultMetadata(doc, i);
    videos[metadata.id] = metadata;
  }

  return videos;
}

/** Parse the video result for relevant information */
function parseResultMetadata(doc: Doc, i: number): VideoItem {
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

  var url = `${process.env.HOST_IO}/app/info.cfm?pid=${doc.id}`;

  const videoUrl = `${process.env.HOST_IO}${doc.webpath}/video/${doc.nasa_id}.${doc.file_extension_video}`;

  return {
    id: doc.nasa_id,
    content,
    description: doc.description,
    start: UTCstart,
    end: UTCend,
    url,
    videoUrl,
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
