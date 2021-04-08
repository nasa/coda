/**
 * Methods for fetching data from the ISS Wiki. Browsers will use a proxy, servers will hit the ISS Wiki directly
 */
import get from "lodash/get";
import { padZeros } from "utils/formatting";

export interface EVA {
  /** EVA name upper-cased with spaces, eg. `US EVA 55` */
  name: string;
  /** Full URL to the wiki */
  wikiURL: string;
  displayTitle: string;
  /** YYYY-MM-DD UTC */
  startDate: string;
  /** UTC */
  startTime: string;
  /** seconds for entire EVA */
  duration: number;
  /** Activity performance keyed by EV */
  activityPerformance: { [key: string]: Activity[] };
  dayNight: DayNight;
  execution?: {
    /** Keyed by actor, eg. `EV1` */
    [key: string]: Activity[];
  };
  crew?: Crew;
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

export interface WikiResults {
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

export interface WikiResponse {
  errorResponse: boolean;
  code: string;
  info: string;
  response: {
    error: {
      code: string;
      info: string;
      "*": string;
    };
  };
  request: Request;
}

/**
 * Query the ISS Wiki through our proxy. Safe to call from the client
 * @param query A wiki ask query string
 */
async function fetchWiki(query: string, _action): Promise<WikiResults> {
  // the proxy doesn't like all the newlines in our nicely formatted queries. get rid of them
  const strippedQuery = query.trim().replace(/\r?\n|\r/g, "");
  const queryString = encodeURIComponent(`"${strippedQuery}"`);
  let url = `${process.env.PROXY_ORIGIN}/coda_server/getwiki.php?wikiparam=${queryString}`;
  if (process.env.NEXT_PUBLIC_APP_ENV !== "prod") {
    url = url + "&dev=true";
  }
  const data = await fetch(url);
  return await data.json();
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
async function getAllEVAs(): Promise<EVASummaryResponse> {
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
 * @param evaName the EVA's name on the wiki, eg. `US EVA 55`
 */
export async function getEVADetails(evaName: string): Promise<ParsedEVADetails> {
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
      "Related article": any[];
      Color: string[];
      Actor: string[];
    };
  };
}

// Activities in the executed timeline on the wiki have colors associated with them (so the timeline has different colored bars)
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
  white: "#96a5a7",
  black: "#000000",
  pink: "#FFC0CB",
};

/**
 * Get as-executed data for a given EV on a given EVA
 * @param evaName the EVA's name on the wiki, eg. `US EVA 55`
 */
async function _getAsExecuted(evaName: string, evNum: number) {
  const actorName = `Actor${evNum + 1}`;
  const query = `
    [[From page::~${evaName}/*xecuted*]]
    [[Assigned to::${actorName}]]
    |mainlabel=-|?Index
    |? Has text title
    |? Duration hour
    |? Duration minute
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

function parseAsExecuted(results: EVAAsExecuted): Activity[] {
  const res = [];

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

export interface AllExecution {
  /** Keyed as EVA name, upper-cased with spaces, eg. `US EVA 55` */
  [key: string]: {
    /** Keyed as actor name, eg `EV1`, or a proper name, eg. `Bob` */
    [key: string]: Activity[];
  };
}

/** Get as-executed data for a given EV on a given EVA */
async function getAllAsExecuted(): Promise<AllExecution> {
  const query = `
    [[From page::~US EVA*/*xecuted*]]
    |mainlabel=-|?Index
    |? Has text title
    |? Duration hour
    |? Duration minute
    |? Related article
    |? Color
    |? Actor
    |named args=yes
    |sort=Actor, Index
    |limit=1000000
  `;
  const res = await fetchWiki(query, "getAllAsExecuted");
  const results: EVAAsExecuted = res.query.results;
  return parseAllAsExecuted(results);
}

function parseAllAsExecuted(results: EVAAsExecuted): AllExecution {
  const res = {};

  Object.keys(results).forEach((r) => {
    // results are keyed with strings like
    // "US EVA 49/As-executed timeline# 599b16d6cf9daca7f7d8f938b04a2404"
    const evaName = r.split("/")[0];
    if (!(evaName in res)) {
      res[evaName] = {};
    }

    let actor = results[r].printouts["Actor"][0];
    // SSRMS is "Actor 1", EV1 is "Actor 2", EV2 is "Actor 3". let's standardize "Actor 2" to EV1 and "Actor 3" to EV2. omit Actor 1 / SSRMS. If the actor has another name, just go with it
    if (actor.indexOf("Actor") > -1) {
      const [_, actorNumber] = actor.split("Actor");
      if (+actorNumber - 1 < 1) {
        // must be SSRMS
        return;
      }
      actor = `EV${+actorNumber - 1}`;
    }
    if (!(actor in res[evaName])) {
      res[evaName][actor] = [];
    }

    const durationHour = results[r].printouts["Duration hour"][0];
    const durationMinute = results[r].printouts["Duration minute"][0];
    const durationTotalSeconds = +durationHour * 3600 + +durationMinute * 60;

    let colorString = results[r].printouts["Color"][0];
    if (colorString in colorTranslator) {
      colorString = colorTranslator[colorString];
    } else {
      console.error("color not found: " + colorString);
    }
    const activity: Activity = {
      content: results[r].printouts["Has text title"][0],
      duration: durationTotalSeconds,
      color: colorString,
    };
    if (activity.color === "gray") activity.color = "grey";

    res[evaName][actor].push(activity);
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

/** Crew names keyed by actor, eg. `{EV1: "Bob"}` */
export interface Crew {
  EV1: string;
  EV2: string;
  SUIT_IV: string;
}

/** The proxy needs the `+` in the query to get pre-encoded as `%2B`, while MWBot wants it as a `+` */
const plus = () => {
  return typeof window !== "undefined" ? "%2B" : "+";
};

/**
 * Get crew assignment data for a EVA
 * @param evaName the EVA's name on the wiki, eg. `US EVA 55`
 */
async function _getCrew(evaName: string) {
  const query = `
    [[Crew involved with subject::${plus()}]]
    [[From page::${evaName}]]
    |? Has full name
    |? Has role
    |? Has EMU Page
  `;
  const res = await fetchWiki(query, "getCrew");
  const results: EVACrewResults = res.query.results;
  return parseCrew(results);
}

function parseCrew(results: EVACrewResults): Crew {
  let crewObject: Crew = {
    EV1: "",
    EV2: "",
    SUIT_IV: "",
  };
  for (let objKey in results) {
    let useableKey = results[objKey]["printouts"]["Has role"][0]["fulltext"]
      .replace(/ /g, "_")
      .toUpperCase();
    crewObject[useableKey] = results[objKey]["printouts"]["Has full name"][0]["fulltext"];
  }

  return crewObject;
}

export interface AllCrews {
  [key: string]: Crew;
}

/** Get crew assignment data for all EVAs */
async function getAllCrew(): Promise<AllCrews> {
  const query = `
    [[Crew involved with subject::${plus()}]]
    [[From page::~US EVA*]]
    |? Has full name
    |? Has role
    |? Has EMU Page
    |limit=10000
  `;
  const res = await fetchWiki(query, "getAllCrew");
  const results: EVACrewResults = res.query.results;
  return parseAllCrew(results);
}

function parseAllCrew(results: EVACrewResults): AllCrews {
  const res = {} as AllCrews;

  Object.keys(results).forEach((result) => {
    const actor = get(results, [result, "printouts", "Has role", 0, "fulltext"], "")
      .replace(/ /g, "_")
      .toUpperCase();

    if (actor === "") {
      return;
    }

    const name = get(results, [result, "printouts", "Has full name", 0, "fulltext"], "");

    // result keys are in the form of
    // "'US EVA 28# c9d6c0b4412f9729eee290e84cf1aa63'"
    const [evaName] = result.split("#");
    const formattedEVAName = evaName.replace(/ /g, "_").toLowerCase();
    if (!(formattedEVAName in res)) {
      res[formattedEVAName] = { EV1: "", EV2: "", SUIT_IV: "" };
    }
    res[formattedEVAName][actor] = name;
  });

  return res;
}

export interface DayNight {
  dataStartUTC?: number;
  events?: Activity[];
}

/** Fetch as-planned and as-executed EVA data and format it for passing to the redux store */
export async function buildEVAStore(): Promise<EVA[]> {
  const asPlanned = await getAllEVAs();
  const asExecuted = await getAllAsExecuted();
  const crews = await getAllCrew();

  return Object.keys(asPlanned).map((evaName) => {
    const formattedEVAName = evaName.replace(/ /g, "_").toLowerCase();
    let duration = -1;
    const [wikiDuration] = asPlanned[evaName].printouts.Duration;
    // for whatever reason, if no duration is specified the wiki gives us ":"
    if (wikiDuration !== ":") {
      const [h, m] = wikiDuration.split(":");
      duration = +h * 3600 + +m * 60;
    }
    const [yyyy, mm, dd] = asPlanned[evaName].printouts["Start date"][0].raw
      .substring(2)
      .split("/");
    const startDate = `${yyyy}-${padZeros(+mm, 2)}-${padZeros(+dd, 2)}`;

    return {
      name: evaName,
      wikiURL: asPlanned[evaName].fullurl,
      displayTitle: asPlanned[evaName].printouts["EVA title"][0],
      startDate,
      startTime: asPlanned[evaName].printouts["Start time"][0],
      duration,
      execution: get(asExecuted, evaName, { EV1: [], EV2: [] }),
      crew: get(crews, formattedEVAName, { EV1: "Unknown", EV2: "Unknown", SUIT_IV: "Unknown" }),
      // we need video data to calculate activityPerformance
      activityPerformance: { EV1: [], EV2: [] },
      // the wiki doesn't actually give us dayNight
      dayNight: { events: [], dataStartUTC: 0 },
    };
  });
}
