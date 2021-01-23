/*
SERVER ONLY methods for fetching from wiki. Only use this code within `getStaticProps()` or `getServerSideProps()` functions
*/
import { promises as fs } from "fs";
import MWBot from "mwbot";
import FileCookieStore from "tough-cookie-filestore";
import request from "request";
import { memoize } from "lodash";
import fetch from "node-fetch";
import { padZeros } from "utils/formatting";
import dayNight from "../mocks/fakedata/daynight.json";

const COOKIE_JAR = "services/.cookies.json";

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
  dayNight: {
    dataStartUTC?: number;
    events?: Activity[];
  };
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

async function _getMWBot() {
  const apiUrl = process.env.WIKI_API_URL;
  const bot = new MWBot({
    apiUrl,
    verbose: true,
    silent: false,
  });

  // just make sure the cookie jar file exists
  try {
    await fs.writeFile(COOKIE_JAR, "", { flag: "wx" });
  } catch (e) {}

  bot.setGlobalRequestOptions({
    qs: {
      format: "json",
    },
    followRedirect: true,
    followAllRedirects: true,
    maxRedirects: 10,
    headers: {
      "User-Agent": "js-api-CODAdev",
      "X-SKIP-SAML": "True",
    },
    timeout: 10000,
    jar: request.jar(new FileCookieStore(COOKIE_JAR)),
    json: true,
  });

  try {
    // check if our cookies are still good. if not, log in
    // TODO: try to hit the wiki first with the actual request
    await bot.read("Main_Page");
  } catch (e) {
    try {
      await bot.login({
        username: process.env.WIKI_USER,
        password: process.env.WIKI_PASSWORD,
      });
    } catch (e) {
      console.error("Wiki login unsuccessful");
      throw e;
    }
  }

  return bot;
}

const getMWBot = memoize(_getMWBot);

/**
 * Perform a query against the ISS Wiki with the given query parameters
 * @param action Optional string for specifying the action type for local mocking
 */
async function fetchWiki(query: string, action?: string): Promise<WikiResponse> {
  let res: WikiResponse;

  // we're in the local environment. fake the request using a mock service worker
  if (process.env.NEXT_PUBLIC_APP_ENV === "local") {
    const res = await fetch(process.env.WIKI_API_URL, {
      headers: {
        "X-MOCK-ACTION": action,
      },
    });
    return res.json();
  }

  const bot = await getMWBot();

  try {
    res = await bot.request({ action: "ask", format: "json", query });
  } catch (e) {
    throw e;
  }
  return res;
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
      /** In H:MM, eg `[ 6:32 ]`. Defaults to `[ : ]` when no duration is present */
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

/** Get a summary of all EVAs on the wiki */
async function _getAllEVAs(): Promise<EVASummaryResponse> {
  // wiki query parameters
  const query = `
    [[~US EVA*]]
    [[EVA Classification::Scheduled or Historical]]
    |? EVA title
    |? Start date
    |? Start time
    |? Duration
    |sort=Start date
    |limit=10000
  `;
  const res = await fetchWiki(query, "getEVAs");
  return res.query.results;
}

/** Memoized call to get a summary of all EVAs on the wiki */
export const getAllEVAs = memoize(_getAllEVAs);

/** EVA Metadata */
interface EVADetails {
  [key: string]: {
    printouts: {
      "EVA Title": string[];
      "Start date": WikiTimestamp[];
      /** In H:MM, eg `[ 6:32 ]`. Defaults to `[ : ]` when no duration is present */
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
  const query = `
    [[ ${evaName} ]]
    |? EVA title
    |? Start date
    |? Start time
    |? Duration
  `;
  const res = await fetchWiki(query, "getEVADetails");
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
async function _getAsExecuted(evaName: string, evNum: number) {
  const actorName = `Actor${evNum + 1}`;
  const query = `
    [[From page::~${evaName}/*xecuted*]]
    [[Assigned to::${actorName}]]
    |mainlabel=-|?Index
    |? Has text title
    |? Duration hour
    |? Duration minute
    |? Depends on
    |? Related article
    |? Color
    |? Actor
    |named args=yes
    |sort=Actor, Index
  `;
  const res = await fetchWiki(query, `getAsExecutedEV${evNum}`);
  const results: EVAAsExecuted = res.query.results;
  return parseAsExecuted(results);
}

/** Memoized call to get as-executed data for a given EV on a given EVA */
export const getAsExecuted = memoize(_getAsExecuted);

function parseAsExecuted(results: EVAAsExecuted): Activity[] {
  const res = [];

  // these colors are muted equivalents giving a more pastel result. Found at https://htmlcolorcodes.com/
  const colorTranslator = {
    red: "#C0392B",
    grey: "#7F8C8D",
    gray: "#7F8C8D",
    blue: "#2980B9",
    orange: "#CA6F1E",
    green: "#28B463",
    purple: "#8E44AD",
    yellow: "#B7950B",
    white: "#FFFFFF",
    black: "#000000",
  };

  Object.keys(results).forEach((r) => {
    const durationHour = results[r]["printouts"]["Duration hour"][0];
    const durationMinute = results[r]["printouts"]["Duration minute"][0];
    const durationTotalSeconds = +durationHour * 3600 + +durationMinute * 60;

    let colorString = results[r]["printouts"]["Color"][0];
    if (colorString in colorTranslator) {
      colorString = colorTranslator[colorString];
    } else {
      console.error("color not found: " + colorString);
    }
    const activity: Activity = {
      content: results[r]["printouts"]["Has text title"][0],
      duration: durationTotalSeconds,
      color: colorString,
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
      "Has full name": [
        {
          fulltext: string;
        }
      ];
      "Has role": [
        {
          fulltext: string;
        }
      ];
    };
  };
}

export interface ParsedCrewResults {
  ev1: string;
  ev2: string;
  suit_iv: string;
}

/** Get crew assignment data for a EVA */
async function _getCrew(evaName: string) {
  const query = `
    [[Crew involved with subject::+]]
    [[From page::${evaName}]]
    |? Has full name
    |? Has role
    |? Has EMU Page
  `;
  const res = await fetchWiki(query, `getCrew`);
  const results: EVACrewResults = res.query.results;
  return parseCrew(results);
}

/** Memoized call to get crew assignment data for a EVA */
export const getCrew = memoize(_getCrew);

function parseCrew(results: EVACrewResults): ParsedCrewResults {
  let crewObject: ParsedCrewResults = {
    ev1: "",
    ev2: "",
    suit_iv: "",
  };
  for (let objKey in results) {
    let useableKey = results[objKey]["printouts"]["Has role"][0]["fulltext"]
      .replace(/ /g, "_")
      .toLowerCase();
    crewObject[useableKey] = results[objKey]["printouts"]["Has full name"][0]["fulltext"];
  }

  return crewObject;
}

export interface DayNight {
  dataStartUTC: number;
  events: Activity[];
}

export async function getDayNight(evaName: string) {
  // const query = ``;
  // const res = await fetchWiki(query, `getDayNight`);
  // const results = res;
  // return parseDayNight(results);
  return parseDayNight(dayNight);
}

function parseDayNight(results): DayNight {
  const dateArr = results.startGMT.split(/-| |:/).map(Number);
  const dataStartUTC = Date.UTC(
    dateArr[0],
    dateArr[1] - 1,
    dateArr[2],
    dateArr[3],
    dateArr[4],
    dateArr[5]
  );
  const activityArray = [];

  for (var i = 0; i < results.events.length; i++) {
    let color = "";
    if (results.events[i].content === "Insolation") {
      color = "#B3B6B7"; //day color
    } else {
      color = "#151515"; //night color
    }
    var activityObject = {
      content: results.events[i].content,
      duration: results.events[i]["duration_min"],
      color: color,
    };
    activityArray.push(activityObject);
  }
  return {
    dataStartUTC: dataStartUTC,
    events: activityArray,
  };
}

/** Fetch all EVA as-planned data and format it for passing to the redux store */
export async function buildEVAStore() {
  const EVAs = {} as { [key: string]: EVA };
  const evas = await getAllEVAs();
  Object.keys(evas).forEach((evaName) => {
    const formattedEVAName = evaName.replace(/ /g, "_").toLowerCase();
    let duration = -1;
    const [wikiDuration] = evas[evaName].printouts.Duration;
    // for whatever reason, if no duration is specified the wiki gives us ":"
    if (wikiDuration !== ":") {
      const [h, m] = wikiDuration.split(":");
      duration = +h * 3600 + +m * 60;
    }
    EVAs[formattedEVAName] = {
      name: evaName,
      wikiURL: evas[evaName].fullurl,
      displayTitle: evas[evaName].printouts["EVA title"][0],
      startDate: evas[evaName].printouts["Start date"][0].raw.substring(2),
      startTime: evas[evaName].printouts["Start time"][0],
      duration,
      // we don't have these properties yet
      activityPerformance: {},
      dayNight: {},
    };
  });

  return EVAs;
}
