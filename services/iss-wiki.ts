/*
SERVER ONLY methods for fetching from wiki. Only use this code within `getStaticProps()` or `getServerSideProps()` functions

TODO: CHECK THIS OUT https://www.mediawiki.org/wiki/API:Client_code#JavaScript
*/
import fetch, { Response } from "node-fetch";
import { padZeros } from "utils/formatting";

export interface EVA {
  name: string;
  wikiURL: string;
  displayTitle: string;
  /** UTC */
  startDate: string;
  /** UTC */
  startTime: string;
  /** seconds for entire EVA */
  duration: number;
  /** Activity performance keyed by EV */
  activityPerformance: { [key: string]: Activity[] };
}

export interface Activity {
  content: string;
  color: string;
  /** seconds */
  duration: number;
  // used by the nav-timeline
  startTimeSeconds?: number;
  endTimeSeconds?: number;
}

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
export interface EVASummaryResponse {
  /** Keyed by EVA title, eg `US EVA 1` */
  [key: string]: {
    printouts: {
      "EVA title": string[];
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
export async function getAllEVAs(): Promise<EVASummaryResponse> {
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

export interface ParsedEVADetails {
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
export async function getAsExecuted(evaName: string, evNum: number) {
  const actorName = `Actor${evNum + 1}`;
  const wikiParams = `[[From page::~' . ${evaName} . '/*xecuted*]] [[Assigned to::' . ${actorName} . ']] |mainlabel=-|?Index |?Has text title |?Duration hour |?Duration minute |?Depends on |?Related article |?Color |?Actor |named args=yes |sort=Actor, Index |format = json`;
  const query = encodeURI(`{ text: ${wikiParams} }`);
  const queryParams = `action=ask&query=${query}`;
  const res = await fetchWiki(queryParams, `getAsExecutedEV${evNum}`);
  const results: EVAAsExecuted = res.query.results;
  return parseAsExecuted(results);
}

async function parseAsExecuted(results: EVAAsExecuted): Promise<Activity[]> {
  const res = [];

  Object.keys(results).forEach((r) => {
    const durationHour = results[r]["printouts"]["Duration hour"][0];
    const durationMinute = results[r]["printouts"]["Duration minute"][0];
    const durationTotalSeconds = +durationHour * 3600 + +durationMinute * 60;

    const activity: Activity = {
      content: results[r]["printouts"]["Has text title"][0],
      duration: durationTotalSeconds,
      color: results[r]["printouts"]["Color"][0],
    };
    if (activity.color === "gray") activity.color = "grey";

    res.push(activity);
  });

  return res;
}

interface EVACrewResults {
  /** keyed in the form of `US EVA 55# a4c086604b5aa243bf1f3c99dc06d965` */
  [key: string]: {
    printouts: {
      "Has full name": [{
        fulltext: string;
      }],
      "Has role": [{
        fulltext: string;
      }]
    };
  };
}

export interface ParsedCrewResults {
  ev1: string,
  ev2: string,
  suit_iv: string,
}

/** Get crew assignment data for a EVA */
export async function getCrew(evaName: string) {
  const wikiParams = `[[Crew involved with subject::+]] [[From page::' . ${evaName} . ']] |? Has full name |? Has role |? Has EMU Page  |format = json`;
  const query = encodeURI(`{ text: ${wikiParams} }`);
  const queryParams = `action=ask&query=${query}`;
  const res = await fetchWiki(queryParams, `getCrew`);
  const results: EVACrewResults = res.query.results;
  return parseCrew(results);
}

async function parseCrew(results: EVACrewResults): Promise<ParsedCrewResults> {
  let crewObject = {};
  for (let objKey in results) {
    let useableKey = results[objKey]['printouts']['Has role'][0]['fulltext'].replace(/ /g, "_").toLowerCase();
    crewObject[useableKey] = results[objKey]['printouts']['Has full name'][0]['fulltext'];
  }

  return crewObject;
}