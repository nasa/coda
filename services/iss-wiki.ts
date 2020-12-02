/*
SERVER ONLY methods for fetching from wiki. Only use this code within `getStaticProps()` or `getServerSideProps()` functions

TODO: CHECK THIS OUT https://www.mediawiki.org/wiki/API:Client_code#JavaScript
*/
import fetch, { Response } from "node-fetch";
import { TimingData } from "./io";
import { padZeros } from "utils/formatting";

interface WikiResponse {
  query: {
    printrequests: {
      label: string;
      key: string;
      redi: string;
      typeid: string;
      mode: number;
      format?: string;
    }[];
    results: EVASummaryResponse | EVADetails | any;
  };
}

/**
 * Perform a query against the ISS Wiki with the given query parameters
 * @param action Optional string for specifying the action type for local mocking
 */
async function fetchWiki(
  queryParams: string,
  action?: string
): Promise<WikiResponse> {
  const url = `${process.env.WIKI_API_URL}?format=json&${queryParams}`;
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

  // if we're in the local environment, add a header to make it easy to figure out which fakedata to return when we intercept this request
  if (process.env.APP_ENV === "local" && action) {
    options.headers["X-MOCK-ACTION"] = action;
  }

  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (e) {
    throw e;
  }
  return res.json();
}

interface WikiTimestamp {
  /** eg. `1014163200` */
  timestamp: string;
  /** eg. `1/2002/2/20` */
  raw: string;
}

/** Summary of an EVA in wiki query results */
interface EVASummaryResponse {
  /** Keyed by EVA title, eg `US EVA 1` */
  [key: string]: {
    printouts: {
      "EVA Title": string[];
      "Start date": WikiTimestamp[];
      /** eg. `[ 11:38 ]` */
      "Start Time": string[];
    };
    /** eg. `US EVA 1` */
    fulltext: string;
    /** Full link to the page on the wiki */
    fullurl: string;
    namespace: number;
    exists: "0" | "1";
    displaytitle: string;
  };
}

/** Get a summary of all EVAs on the wiki */
export async function getEVAs(): Promise<EVASummaryResponse> {
  // wiki query parameters
  const getEVAsQuery =
    "[[~US EVA*]] [[EVA Classification::Scheduled or Historical]] |?EVA title |? Start date |? Start time |sort=Start date |format = json";
  const query = encodeURI(`{ text: ${getEVAsQuery} }`);
  const queryParams = `action=ask&query=${query}`;
  const res = await fetchWiki(queryParams, "getEVAs");
  return res.query.results;
}

/** EVA Metadata */
interface EVADetails {
  [key: string]: {
    printouts: {
      "EVA Title": string[];
      "Start date": WikiTimestamp[];
      /** In H:MM, eg `[ 6:32 ]` */
      Duration: string[];
    };
    /** eg. `US EVA 1` */
    fulltext: string;
    /** Full link to the page on the wiki */
    fullurl: string;
    namespace: number;
    exists: "0" | "1";
    displaytitle: string;
  };
}

/**
 * Get metadata about an EVA from the wiki
 */
export async function getEVADetails(evaName): Promise<ParsedEVADetails> {
  const wikiParams = `[[' . ${evaName} . ']] |? EVA title |? Start date |? Start time |? Duration |format = json`;
  const query = encodeURI(`{ text: ${wikiParams} }`);
  const queryParams = `action=ask&query=${query}`;
  const res = await fetchWiki(queryParams, "getEVADetails");
  const results: EVADetails = res.query.results;
  return parseDetailsObject(results);
}

interface ParsedEVADetails {
  evaName: string;
  evaTitle: string;
  /** GMT HH:MM */
  startTime: string;
  /** H:MM */
  duration: string;
  /** Wiki URL */
  fullURL: string;
  /** YYYY-MM-DD */
  evaDate: string;
}

/** Get useful information about an EVA from what the wiki gave us */
function parseDetailsObject(res: EVADetails): ParsedEVADetails {
  const evaName = Object.keys(res)[0];
  const evaData = res[evaName];
  const evaDate = evaData["printouts"]["Start date"][0]["raw"].substring(2);
  const [year, month, day] = evaDate.split("/");
  return {
    evaName,
    evaTitle: evaData["printouts"]["EVA title"][0],
    startTime: evaData["printouts"]["Start time"][0],
    duration: evaData["printouts"]["Duration"][0],
    fullURL: evaData["fullurl"],
    evaDate: `${year}-${padZeros(+month, 2)}-${padZeros(+day, 2)}`,
  };
}

interface EVAAsExecuted {
  /** keyed in the form of `US EVA 55/As-executed summary timeline# 868b8afb495ff99585ccfea0263fec03` */
  [key: string]: {
    printouts: {
      Index: number[];
      "Has text title": string[];
      "Duration hour": number[];
      "Duration minute": number[];
      "Depends on": any[];
      "Related article": any[];
      Color: string[];
      Actor: string[];
    };
  };
}

/** Get as-executed data for a given EV on a given EVA */
export async function getAsExecuted(
  evaName: string,
  evNum: number,
  gTimingData: TimingData,
  ActivityStartUTCMilliseconds: number
) {
  const actorName = `Actor${evNum + 1}`;
  const wikiParams = `[[From page::~' . ${evaName} . '/*xecuted*]] [[Assigned to::' . ${actorName} . ']] |mainlabel=-|?Index |?Has text title |?Duration hour |?Duration minute |?Depends on |?Related article |?Color |?Actor |named args=yes |sort=Actor, Index |format = json`;
  const query = encodeURI(`{ text: ${wikiParams} }`);
  const queryParams = `action=ask&query=${query}`;
  const res = await fetchWiki(queryParams, `getAsExecutedEV${evNum}`);
  const results: EVAAsExecuted = res.query.results;
  return parseAsExecuted(results, gTimingData, ActivityStartUTCMilliseconds);
}

interface activity {
  content: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  color: string;
}

async function parseAsExecuted(
  results: EVAAsExecuted,
  gTimingData: TimingData,
  ActivityStartUTCMilliseconds: number
): Promise<activity[]> {
  const activityArray = [];
  let thisStartTimeSeconds =
    (ActivityStartUTCMilliseconds - gTimingData.video_earliestStart.getTime()) /
    1000;

  for (let key in results) {
    if (results.hasOwnProperty(key)) {
      const durationHour = results[key]["printouts"]["Duration hour"][0];
      const durationMinute = results[key]["printouts"]["Duration minute"][0];
      const durationTotalSeconds = (durationHour * 60 + durationMinute) * 60;

      const activityObject: activity = {
        content: results[key]["printouts"]["Has text title"][0],
        startTimeSeconds: thisStartTimeSeconds,
        endTimeSeconds: thisStartTimeSeconds + durationTotalSeconds,
        color: results[key]["printouts"]["Color"][0],
      };
      if (activityObject.color === "gray") activityObject.color = "grey";

      thisStartTimeSeconds = thisStartTimeSeconds + durationTotalSeconds;
      activityArray.push(activityObject);
    }
  }
  return activityArray;
}

// function ajaxGetAudioMetadataJSON() {
//   $.ajaxSetup({
//     scriptCharset: "utf-8",
//     contentType: "application/json; charset=utf-8",
//   });
//   var url = "/CODA_data/US_EVA_55/audio/US_EVA_55_audio_metadata.json";
//   if (location.hostname === "localhost") {
//     url = "https://coda-dev.fit.nasa.gov" + url;
//   }
//   return fetch(url, {})
//     .then(function (resp) {
//       gAudioMetadata = resp;

//       for (var i = 0; i < gAudioMetadata.length; i++) {
//         gAudioMetadata[i].startTimeSeconds =
//           (new Date(gAudioMetadata[i].start_time) -
//             gTimingData.video_earliestStart) /
//           1000;
//         gAudioMetadata[i].endTimeSeconds =
//           (new Date(gAudioMetadata[i].end_time) -
//             gTimingData.video_earliestStart) /
//           1000;
//       }
//       console.log("ajaxGetAudioMetadataJSON completed.");
//     })
//     .catch(function (jqXHR, textStatus, errorThrown) {
//       console.error(jqXHR);
//       console.error(textStatus);
//       console.error(errorThrown);
//     });
// }

// export function ajaxWikiGetEVADetailsByDate(evaDate) {
//   var url = "./pullwiki.php?action=getEVADetailsByDate&evaDate=" + evaDate;
//   if (location.hostname === "localhost") {
//     url =
//       "https://coda-dev.fit.nasa.gov/CODA_ISS/pullwiki.php?action=getEVADetailsByDate&evaDate=" +
//       evaDate;
//   } else if (location.hostname === "coda-iss.develop") {
//     // use fake data if on dev
//     url = "fakedata/getEVADetailsByDate2019-08-21.json";
//   }
//   $.ajaxSetup({
//     scriptCharset: "utf-8",
//     contentType: "application/json; charset=utf-8",
//   });
//   return fetch(url, function (resp) {
//     gEVADetails = createDetailsObject(resp);

//     displayEVADetails(gEVADetails);
//     console.log("ajaxWikiGetEVADetailsByDate completed.");
//   }).catch(function (jqXHR, textStatus, errorThrown) {
//     console.error(jqXHR);
//     console.error(textStatus);
//     console.error(errorThrown);
//   });
// }

// export function ajaxWikiGetCrew(evaName) {
//   var url = "./pullwiki.php?action=getCrew&evaName=" + evaName;
//   if (location.hostname === "localhost") {
//     url =
//       "https://coda-dev.fit.nasa.gov/CODA_ISS/pullwiki.php?action=getCrew&evaName=" +
//       evaName;
//   } else if (location.hostname === "coda-iss.develop") {
//     // use fake data if on dev
//     url = "fakedata/getCrewUS_EVA_55.json";
//   }
//   $.ajaxSetup({
//     scriptCharset: "utf-8",
//     contentType: "application/json; charset=utf-8",
//   });
//   return fetch(url, function (resp) {
//     var crewObject = {};
//     var resultObject = resp["query"]["results"];
//     for (var key in resultObject) {
//       if (resultObject.hasOwnProperty(key)) {
//         crewObject[resultObject[key]["printouts"]["Has role"][0]["fulltext"]] =
//           resultObject[key]["printouts"]["Has full name"][0]["fulltext"];
//       }
//     }
//     document.getElementById("ev1TitleSpan").innerHTML = crewObject.EV1;
//     document.getElementById("ev2TitleSpan").innerHTML = crewObject.EV2;
//     console.log("ajaxWikiGetCrew completed.");
//   }).catch(function (jqXHR, textStatus, errorThrown) {
//     console.error(jqXHR);
//     console.error(textStatus);
//     console.error(errorThrown);
//   });
// }
