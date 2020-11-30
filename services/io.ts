/*
SERVER ONLY methods for fetching from Imagery Online (IO). Only use this code within `getStaticProps()` or `getServerSideProps()` functions
*/
import fetch from "node-fetch";

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

/** Represents a single video search result from IO */
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
  /** Title of the EVA, eg. `EVA 55` */
  md_title: string;
  description: string;
  md_orbit_ground: number;
  has_audio_file: 0 | 1;
  asset_type: number;
  file_extension_video: string;
  /** eg. `iss060m532` */
  nasa_prefix: string;
  /**
   * eg. `iss060m532331624`. There is an exception for video recorded during LOS
   * Breakdown:
   * iss  = ISS video
   * 053  = Expedition 53
   * m    = moving imagery e.g. video
   * 53   = Downlink 3, downlinked after an LOS. Realtime downlink would be 03
   * 278  = GMT day 278
   * 1939 = Actual start time of the video
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

function getIO(params: string) {
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
  return fetch(url, options);
}

/**
 * Fetch video data from IO
 */
export default async function getVideoData(
  year: number,
  month: number,
  day: number
): Promise<any> {
  const rangeStartYear = year;
  const rangeStartMonth = month;
  const rangeStartDay = day;
  const rangeEndYear = year;
  const rangeEndMonth = month;
  const rangeEndDay = day;

  const rangeStartIO =
    rangeStartMonth + "-" + rangeStartDay + "-" + rangeStartYear;
  const rangeEndIO = rangeEndMonth + "-" + rangeEndDay + "-" + rangeEndYear;
  const rangeStartTimeline = new Date(
    Date.UTC(rangeStartYear, rangeStartMonth, rangeStartDay) - 60 * 60 * 1000
  );
  const rangeEndTimeline = new Date(
    Date.UTC(rangeEndYear, rangeEndMonth, rangeEndDay) + 6 * 60 * 60 * 1000
  );

  const queryParams = `s_dt=${rangeStartIO}&e_dt=${rangeEndIO}&as=2?key=${process.env.IO_KEY}&format=json`;

  return getIO(queryParams)
    .then((res) => res.json())
    .then(parseIOResponse);
}

function parseIOResponse(res: IOResponse) {
  const { docs } = res.results.response;

  const gVideoItems = [];
  const output = "";
  let gTimingData = {};
  let beyondSixGroupId;
  let nonDownlinkGroupId;
  let earliestStart;
  let latestEnd;

  const groups = [
    { id: 0, content: "D/L 01", value: 1 },
    { id: 1, content: "D/L 02", value: 2 },
    { id: 2, content: "D/L 03", value: 3 },
    { id: 3, content: "D/L 04", value: 4 },
    { id: 4, content: "D/L 05", value: 5 },
    { id: 5, content: "D/L 06", value: 6 },
    { id: 6, content: "Non-Downlink", value: 7 },
  ];

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const metadata = pullVideoMetadata(doc);
    gVideoItems.push({
      id: i + 1,
      ...metadata,
    });

    if (
      !gTimingData["video_earliestStart"] ||
      metadata.start.getTime() < gTimingData["video_earliestStart"].getTime()
    ) {
      gTimingData["video_earliestStart"] = new Date(
        metadata.start.toUTCString()
      );
    }
    if (
      !gTimingData["video_latestEnd"] ||
      metadata.end.getTime() > gTimingData["video_latestEnd"].getTime()
    ) {
      gTimingData["video_latestEnd"] = new Date(metadata.end.toUTCString());
    }
  }

  gTimingData["EVA_duration_seconds"] =
    (gTimingData["video_latestEnd"] - gTimingData["video_earliestStart"]) /
    1000;

  for (let i = 0; i < gVideoItems.length; i++) {
    gVideoItems[i]["missionSecondsStart"] =
      (gVideoItems[i]["start"] - gTimingData["video_earliestStart"]) / 1000;
    gVideoItems[i]["missionSecondsEnd"] =
      (gVideoItems[i]["end"] - gTimingData["video_earliestStart"]) / 1000;
    gVideoItems[i]["durationSeconds"] =
      gVideoItems[i]["missionSecondsEnd"] -
      gVideoItems[i]["missionSecondsStart"];
  }

  gVideoItems.sort(
    //sorts by priority first, then duration second. Counterintuitively, this array is later used to choose the item with the highest array position for the preferred video stream for a given group and time.
    function (a, b) {
      return (
        +(a.priority > b.priority) ||
        +(a.priority === b.priority) - 1 ||
        +(a.durationSeconds > b.durationSeconds) ||
        +(a.durationSeconds === b.durationSeconds) - 1
      );
    }
  );

  const gVideoActivityByGroupBySecond = createMissionVideoActivity(
    gTimingData,
    gVideoItems
  );

  return { gTimingData, gVideoActivityByGroupBySecond, gVideoItems };
}

function pullVideoMetadata(
  doc: Doc
): {
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
} {
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

  const videoUrl =
    process.env.HOST_IO +
    doc.webpath +
    "/video/" +
    doc.nasa_id +
    "." +
    doc.file_extension_video;

  return {
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

function createMissionVideoActivity(gTimingData, gVideoItems) {
  const gVideoActivityByGroupBySecond = [];
  for (let group = 0; group <= 6; group++) {
    const groupSecondsArray = [];
    for (let second = 0; second < gTimingData.EVA_duration_seconds; second++) {
      const vidsThisGroupThisSecond = [];
      for (let i = 0; i < gVideoItems.length; i++) {
        if (
          gVideoItems[i].group === group &&
          second >= gVideoItems[i].missionSecondsStart &&
          second <= gVideoItems[i].missionSecondsEnd
        ) {
          vidsThisGroupThisSecond.push(i);
        }
      }
      let vidIndex;
      if (vidsThisGroupThisSecond.length > 0) {
        vidIndex = vidsThisGroupThisSecond[vidsThisGroupThisSecond.length - 1];
      } else {
        vidIndex = -1;
      }
      groupSecondsArray.push(vidIndex);
    }
    gVideoActivityByGroupBySecond.push(groupSecondsArray);
  }
  return gVideoActivityByGroupBySecond;
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
