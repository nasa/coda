/*
SERVER ONLY methods for fetching from wiki. Only use this code within `getStaticProps()` or `getServerSideProps()` functions

TODO: CHECK THIS OUT https://www.mediawiki.org/wiki/API:Client_code#JavaScript
*/
import fetch, { Response } from "node-fetch";
import { padZeros } from "utils/formatting";

interface WikiResponse {
  query: any;
  results: any;
}

async function getWiki(
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

export async function getEVAs() {
  // wiki query parameters
  const getEVAsQuery =
    "[[~US EVA*]] [[EVA Classification::Scheduled or Historical]] |?EVA title |? Start date |? Start time |sort=Start date |format = json";
  const query = encodeURI(`{ text: ${getEVAsQuery} }`);
  const queryParams = `action=ask&query=${query}`;
  return getWiki(queryParams, "getEVAs");
}

/** EVA Metadata */
interface evaDetails {
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

/**
 * Get metadata about an EVA from the wiki
 */
export async function getEVADetails(evaName): Promise<evaDetails> {
  const wikiParams = `[[' . ${evaName} . ']] |? EVA title |? Start date |? Start time |? Duration |format = json`;
  const query = encodeURI(`{ text: ${wikiParams} }`);
  const queryParams = `action=ask&query=${query}`;
  const res = await getWiki(queryParams, "getEVADetails");
  return createDetailsObject(res);
}

function createDetailsObject(res): evaDetails {
  const evaName = Object.keys(res["query"]["results"])[0];
  const evaData = res["query"]["results"][evaName];
  const evaDate = evaData["printouts"]["Start date"][0]["raw"].substring(2);
  const [year, month, day] = evaDate.split("/");
  return {
    evaName,
    evaTitle: evaData["printouts"]["EVA title"][0],
    startTime: evaData["printouts"]["Start time"][0],
    duration: evaData["printouts"]["Duration"][0],
    fullURL: evaData["fullurl"],
    evaDate: `${year}-${padZeros(month, 2)}-${padZeros(day, 2)}`,
  };
}

/** Get as-executed data for a given EV on a given EVA */
export async function getAsExecuted(
  evaName: string,
  evNum: number,
  gTimingData,
  ActivityStartUTCMilliseconds: number
) {
  const actorName = `Actor${evNum + 1}`;
  const wikiParams = `[[From page::~' . ${evaName} . '/*xecuted*]] [[Assigned to::' . ${actorName} . ']] |mainlabel=-|?Index |?Has text title |?Duration hour |?Duration minute |?Depends on |?Related article |?Color |?Actor |named args=yes |sort=Actor, Index |format = json`;
  const query = encodeURI(`{ text: ${wikiParams} }`);
  const queryParams = `action=ask&query=${query}`;
  const data = await getWiki(queryParams, `getAsExecutedEV${evNum}`);
  return parseAsExecuted(
    data["query"]["results"],
    gTimingData,
    ActivityStartUTCMilliseconds
  );
}

interface activity {
  content: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  color: string;
}

async function parseAsExecuted(
  results,
  gTimingData,
  ActivityStartUTCMilliseconds: number
): Promise<activity[]> {
  const activityArray = [];
  let thisStartTimeSeconds =
    (ActivityStartUTCMilliseconds - gTimingData.video_earliestStart.getTime()) /
    1000;

  for (let key in results) {
    if (results.hasOwnProperty(key)) {
      const durationHour = parseInt(
        results[key]["printouts"]["Duration hour"][0]
      );
      const durationMinute = parseInt(
        results[key]["printouts"]["Duration minute"][0]
      );
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
