/*
Server-side implementations for hitting the ISS Wiki directly. Caches responses whenever possible.

See sandboxes:
* ISS: https://wiki.jsc.nasa.gov/iss/index.php/Special:ApiSandbox#action=ask&format=json
* Exploration: https://wiki.jsc.nasa.gov/exploration/index.php/Special:ApiSandbox#action=ask&format=json&query=
*/
import fs from "fs";
import get from "lodash/get";
import deepEquals from "lodash/isEqual";
import isNil from "lodash/isNil";
import MWBot from "mwbot";
import { FileCookieStore } from "tough-cookie-file-store";
import request from "request";
import fetchWithCache from "../processing/cache-client";
import { formatEVADisplayTitle, padZeros } from "utils/formatting";
import { collection, sequenceType } from "utils/consts";

const COOKIE_JAR_DIR = `.cookies`;
const COOKIE_JAR = `${COOKIE_JAR_DIR}/cookies-wiki-${process.env.VITE_PUBLIC_APP_ENV}.json`;

/** Get a read-only "bot" for the wiki */
async function getMWBot(wiki: string) {
  const apiUrl = `${process.env.WIKI_BASE_URL}/${wiki}/api.php`;
  const bot = new MWBot({
    apiUrl,
    verbose: true,
    silent: false,
  });

  // make sure the cookie jar file exists
  try {
    if (!fs.existsSync(COOKIE_JAR_DIR)) {
      fs.mkdirSync(COOKIE_JAR_DIR);
    }
    fs.writeFileSync(COOKIE_JAR, "", { flag: "wx" }); // create the file if it doesn't exist (wx)
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

  return bot;
}

/**
 * Load mock data from this repo
 */
async function mockData(_query: string, action: string): Promise<WikiResults> {
  console.log(`Mocking request for: ${action}...`);

  switch (action) {
    case "getAllEVAs":
      const getAllEVAsMockData = require("../../../mocks/fakedata/getAllEVAs.json");
      return await Promise.resolve(getAllEVAsMockData);
    case "getAllAsExecuted":
      const getAllAsExecutedMockData = require("../../../mocks/fakedata/getAllAsExecuted.json");
      return await Promise.resolve(getAllAsExecutedMockData);
    case "getAllCrew":
      const getAllCrewMockData = require("../../../mocks/fakedata/getAllCrew.json");
      return await Promise.resolve(getAllCrewMockData);
    default:
      console.error(`Unknown Wiki request action: '${action}'`);
      return await Promise.resolve(null);
  }
}

/** Checks if the response from the wiki mean we aren't logged in */
function isLoginError(e: any | WikiResponse): e is WikiResponse {
  return e.errorResponse && e.code === "readapidenied";
}

/** Options for querying the wiki API */
interface FetchWikiOptions {
  /** Selects which wiki to use, eg. the "iss" or "exploration" path in https://wiki.jsc.nasa.gov/iss */
  wiki: string;
  /** Semantic Mediawiki "ask" query string. Only applicable for "ask" actions` */
  askQuery?: string;
  /** Type of wiki query. Defaults to `ask` */
  action?: string;
  /** Properties to use when performing a "parse" action */
  parseQuery?: {
    page: string;
    prop: string;
  };
  /** Optional mock type for local development */
  mock?: string;
}

const defaultFetchWikiOptions: FetchWikiOptions = {
  askQuery: "",
  wiki: "iss",
  action: "ask",
};

/**
 * Perform a query against the wiki. Returns a cached result if this query has already been performed
 */
async function fetchWiki(options: FetchWikiOptions): Promise<WikibotResponse<WikiResults>> {
  const o = { ...defaultFetchWikiOptions, ...options };

  const isLocal = process.env.VITE_PUBLIC_APP_ENV === "local";

  // we're in the local environment. fake the request
  if (isLocal) {
    const data = await mockData(o.askQuery, o.mock);
    return {
      data,
      mocked: true,
    };
  }

  let res: WikiResults;

  const bot = await getMWBot(o.wiki);

  // build the JSON payload to send to the wiki based on FetchWikiOptions.action
  let payload: any = { format: "json", action: o.action };
  if (o.action === "ask") {
    payload = { ...payload, query: o.askQuery };
  } else if (o.action === "parse") {
    payload = { ...payload, ...o.parseQuery };
  }

  try {
    // optmistically try to fetch from the wiki before we know for sure we're logged in
    res = await bot.request(payload);
  } catch (e) {
    if (isLoginError(e)) {
      // we weren't logged in. let's log in
      try {
        await bot.login({
          username: process.env.WIKI_USER,
          password: process.env.WIKI_PASSWORD,
        });
      } catch (e) {
        console.error("Wiki login unsuccessful: ", e);
        throw e;
      }
    } else {
      throw e;
    }
    // we are logged in now. retry the request
    try {
      res = await bot.request(payload);
    } catch (e) {
      console.error("Wiki request error");
      throw e;
    }
  }

  return { data: res };
}

/** Get a summary of all EVAs on the wiki */
async function getAllEVAs(): Promise<WikibotResponse<EVASummaryResponse>> {
  // wiki query parameters
  const askQuery = `
    [[~*S EVA*]]
    [[EVA Classification::Scheduled or Historical]]
    |? EVA title
    |? Maestro event uuid
    |? Start date
    |? Start time
    |? Duration
    |sort=Start date
    |limit=10000
  `;

  const res = await fetchWiki({ askQuery, wiki: "iss", mock: "getAllEVAs" });
  const results = res.data.query.results;
  return {
    mocked: res.mocked,
    data: results,
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

/** Get as-executed data for a given EV on a given EVA */
async function getAllAsExecuted(): Promise<WikibotResponse<AllExecution>> {
  const askQuery = `
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

  const res = await fetchWiki({ askQuery, wiki: "iss", mock: "getAllAsExecuted" });
  const results: AllExecution = parseAllAsExecuted(res.data.query.results);
  return {
    mocked: res.mocked,
    data: results,
  };
}

function parseAllAsExecuted(results: EVAAsExecuted): AllExecution {
  const res: {
    [key: string]: { [key: string]: Activity[] };
  } = {};

  Object.keys(results).forEach((r) => {
    // results are keyed with strings like
    // "US EVA 49/As-executed timeline# 599b16d6cf9daca7f7d8f938b04a2404"
    const evaName = r.split("/")[0];
    if (!(evaName in res)) {
      res[evaName] = {};
    }

    let actor = results[r].printouts["Actor"][0];
    // SSRMS is "Actor 1", EV1 is "Actor 2", EV2 is "Actor 3". let's standardize "Actor 2" to EV1 and "Actor 3" to EV2.
    // omit Actor 1 / SSRMS. If the actor has another name, just go with it
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
      colorString = colorTranslator[colorString as keyof typeof colorTranslator];
    } else {
      console.error("color not found: " + colorString);
    }
    const activityTitle = results[r].printouts["Has text title"][0]
      ? results[r].printouts["Has text title"][0]
      : "";
    const activity: Activity = {
      content: activityTitle.replace("[[", "").replace("]]", ""),
      duration: durationTotalSeconds,
      color: colorString,
    };
    if (activity.color === "gray") activity.color = "grey";

    res[evaName][actor].push(activity);
  });

  return res;
}

/** The proxy needs the `+` in the query to get pre-encoded as `%2B`, while MWBot wants it as a `+` */
const plus = () => {
  return typeof window !== "undefined" ? "%2B" : "+";
};

/** Get crew assignment data for all EVAs */
async function getAllCrew(): Promise<WikibotResponse<AllCrews>> {
  const askQuery = `
    [[Crew involved with subject::${plus()}]]
    [[From page::~US EVA*]]
    |? Has full name
    |? Has role
    |? Has EMU Page
    |limit=10000
  `;

  const res = await fetchWiki({ askQuery, wiki: "iss", mock: "getAllCrew" });
  const results = parseAllCrew(res.data.query.results);
  return {
    mocked: res.mocked,
    data: results,
  };
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
    res[formattedEVAName][actor as keyof Crew] = name;
  });

  return res;
}

/**
 * Fetch as-planned and as-executed EVA data and standardize the format
 *
 * @param agency `us|rs|all`. Get US EVAs, RS EVAs, or all EVAs across both space agencies
 * */
export async function getAllEVAData(
  agency: AgencyQuery,
  forceNew: boolean = false
): Promise<WikibotResponse<Sequence[]>> {
  let mocked = false;

  const retriever = async () => {
    const { data: allEVAs, mocked: allEVAsMocked } = await getAllEVAs();
    const { data: asExecuted, mocked: asExecutedMocked } = await getAllAsExecuted();
    const { data: crews, mocked: crewsMocked } = await getAllCrew();

    mocked = allEVAsMocked || asExecutedMocked || crewsMocked;

    const evas = Object.keys(allEVAs).map((evaName) => {
      const formattedEVAName = evaName.replace(/ /g, "_").toLowerCase();
      let duration = -1;
      const [wikiDuration] = allEVAs[evaName].printouts.Duration;
      // for whatever reason, if no duration is specified the wiki gives us ":"
      if (wikiDuration !== ":") {
        const [h, m] = wikiDuration.split(":");
        duration = +h * 3600 + +m * 60;
      }
      const [yyyy, mm, dd] = allEVAs[evaName].printouts["Start date"][0].raw
        .substring(2)
        .split("/");
      const startDate = `${yyyy}-${padZeros(+mm, 2)}-${padZeros(+dd, 2)}`;

      const displayTitle = formatEVADisplayTitle({
        pageName: evaName,
        descriptiveTitle: allEVAs[evaName].printouts["EVA title"][0],
      });

      return {
        /** EVA name upper-cased with spaces, eg. `US EVA 55`  */
        name: evaName,
        maestroEventUuid: allEVAs[evaName].printouts["Maestro event uuid"][0] || false,
        location: collection.ISS,
        type: sequenceType.EVA,
        dataURL: allEVAs[evaName].fullurl,
        displayTitle,
        startDate,
        startTime: allEVAs[evaName].printouts["Start time"][0],
        duration,
        asPerformed: get(asExecuted, evaName, { EV1: [], EV2: [] }),
        crew: get(crews, formattedEVAName, { EV1: "Unknown", EV2: "Unknown", SUIT_IV: "Unknown" }),
      } as Sequence;
    });

    if (agency === "all") {
      return evas;
    }

    const matchAgency = (eva: Sequence) => {
      const re = new RegExp(`.*${agency} EVA.*`, "i");
      return !isNil(eva.name.match(re));
    };

    return evas.filter(matchAgency);
  };

  const response = await fetchWithCache<Sequence[]>({
    identifier: agency,
    cacheFolder: "wiki",
    retriever,
    cacheAge: 3600, // 1 hour
    forceRetriever: forceNew,
  });
  if (mocked) {
    response.responseMetadata.mocked = true;
  }
  return response;
}

export async function getAllTestEvents(): Promise<WikibotResponse<AllTestEvents>> {
  const askQuery = `
  [[Category:Test event]]
  |? Test date
  |? Start time
  |? UTC Start Date Time
  |? Test environment
  |? Flight environment
  |limit=100000
  |sort=Test date
  `;

  const res = await fetchWiki({
    askQuery,
    wiki: "exploration",
    mock: "getAllTestEvents",
  });
  return {
    mocked: res.mocked,
    data: res.data.query.results,
  };
}

/** Get as-executed data for a given EV on a given EVA */
export async function getTestEventExecution(): Promise<WikibotResponse<AllExecution>> {
  const askQuery = `
    [[From page::~Test_Event*/*imeline*]]
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

  const res = await fetchWiki({
    askQuery,
    wiki: "exploration",
    mock: "getAllAsExecuted",
  });
  const results: AllExecution = parseAllAsExecuted(res.data.query.results);
  return {
    mocked: res.mocked,
    data: results,
  };
}

/** Get crew assignment data for all EVAs */
export async function getTestEventCrews(): Promise<WikibotResponse<AllCrews>> {
  const askQuery = `
    [[Test subject::${plus()}]]
    [[Category:Test_event]]
    |limit=10000
  `;

  const res = await fetchWiki({
    askQuery,
    wiki: "exploration",
    mock: "getAllCrew",
  });
  const results = parseAllCrew(res.data.query.results);
  return {
    mocked: res.mocked,
    data: results,
  };
}

/** Fetch as-planned and as-executed EVA data and standardize the format */
export async function getAllTestEventsData(
  forceNew: boolean = false
): Promise<WikibotResponse<Sequence[]>> {
  let mocked = false;
  const retriever = async () => {
    const { data: allTestEvents, mocked: allTestEventsMocked } = await getAllTestEvents();
    const { data: asExecuted, mocked: asExecutedMocked } = await getTestEventExecution();
    const { data: crews, mocked: crewsMocked } = await getTestEventCrews();

    mocked = allTestEventsMocked || asExecutedMocked || crewsMocked;

    return Object.keys(allTestEvents).map((testEvent) => {
      const testEnvironment = get(
        allTestEvents[testEvent].printouts["Test environment"],
        "[0].fulltext",
        "TEST_EVENTS"
      );
      const flightEnvironment = get(
        allTestEvents[testEvent].printouts["Flight environment"],
        "[0].fulltext",
        "Unknown flight sim"
      );
      let duration = -1;

      let eventDate = "";
      if (allTestEvents[testEvent].printouts["UTC Start Date Time"][0]) {
        eventDate = allTestEvents[testEvent].printouts["UTC Start Date Time"][0].split(" ")[0];
      } else {
        eventDate = allTestEvents[testEvent].printouts["Test date"][0].raw.substring(2);
      }
      const [yyyy, mm, dd] = eventDate.split("/");
      const startDate = `${yyyy}-${padZeros(+mm, 2)}-${padZeros(+dd, 2)}`;

      const rawStartTime = get(
        allTestEvents[testEvent].printouts["UTC Start Date Time"],
        "[0]",
        " 00:00"
      );
      const startTime = rawStartTime.split(" ")[1];

      const displayTitle = `${startDate} ${testEnvironment} / ${flightEnvironment}`;

      return {
        name: testEvent,
        location: collection[testEnvironment],
        type: sequenceType.testing,
        dataURL: allTestEvents[testEvent].fullurl,
        displayTitle,
        startDate,
        startTime,
        duration,
        asPerformed: get(asExecuted, testEvent, { EV1: [], EV2: [] }),
        crew: get(crews, testEvent, { EV1: "Unknown", EV2: "Unknown", SUIT_IV: "Unknown" }),
      };
    });
  };

  const response = await fetchWithCache<Sequence[]>({
    identifier: "test-events",
    cacheFolder: "wiki",
    retriever,
    cacheAge: 3600, // 1 hour
    forceRetriever: forceNew,
  });
  if (mocked) {
    response.responseMetadata.mocked = true;
  }
  return response;
}

export async function fetchSequences(
  source: Source,
  forceNew: boolean = false
): Promise<WikibotResponse<Sequence[]>> {
  if (source === "ISS") {
    return getAllEVAData("us", forceNew);
  } else {
    return getAllTestEventsData(forceNew);
  }
}

/** Get all the manually set shifts for fixing datetimes.
 *
 * Data lives here: https://wiki.jsc.nasa.gov/exploration/index.php/CODA/Datetime_Shifts
 */
export async function fetchDatetimeOverrides(
  forceNew: boolean = false
): Promise<WrappedResponse<DatetimeOverrides>> {
  const parseQuery = {
    page: "CODA/Datetime_Shifts",
    prop: "wikitext",
  };

  const retriever = async () => {
    const res = await fetchWiki({
      parseQuery,
      wiki: "exploration",
      action: "parse",
    });
    return parseWikitextTableIntoDatetimeOverrides(res.data.parse.wikitext["*"]);
  };

  return await fetchWithCache<DatetimeOverrides>({
    identifier: "datetime-overrides",
    cacheFolder: "wiki",
    retriever,
    cacheAge: 604800, //1 week
    forceRetriever: forceNew,
  });
}

/** Get all the manually set media source overrides.
 *
 * Data lives here: https://wiki.jsc.nasa.gov/exploration/index.php/CODA/Media_Source_Overrides
 */
export async function fetchMediaOverrides(
  forceNew: boolean = false
): Promise<WrappedResponse<MediaSourceOverride[]>> {
  const parseQuery = {
    page: "CODA/Media_Source_Overrides",
    prop: "wikitext",
  };

  const retriever = async () => {
    const res = await fetchWiki({
      parseQuery,
      wiki: "exploration",
      action: "parse",
    });
    return parseWikitextTableIntoMediaSourceOverrides(res.data.parse.wikitext["*"]);
  };

  return await fetchWithCache<MediaSourceOverride[]>({
    identifier: "media-overrides",
    cacheFolder: "wiki",
    retriever,
    // cacheAge: 604800, //1 week
    // cacheAge: 31536000, // 1 year
    cacheAge: 86400, // 1 day
    forceRetriever: forceNew,
  });
}

/** Get the list of ancillary data sources from the wiki
 *
 * Data lives here: https://wiki.jsc.nasa.gov/exploration/index.php/CODA/Ancillary_Data_Sources
 */
export async function fetchAncillaryDataSourceList(
  forceNew: boolean = false
): Promise<WrappedResponse<AncillaryDataSource[]>> {
  const parseQuery = {
    page: "CODA/Ancillary_Data_Sources",
    prop: "wikitext",
  };

  const retriever = async () => {
    const res = await fetchWiki({
      parseQuery,
      wiki: "exploration",
      action: "parse",
    });
    return parseWikitextTableIntoAncillaryDataSources(res.data.parse.wikitext["*"]);
  };

  return await fetchWithCache<AncillaryDataSource[]>({
    identifier: "ancillary-data-sources",
    cacheFolder: "wiki",
    retriever,
    cacheAge: 604800, //1 week
    forceRetriever: forceNew,
  });
}

/** Given wikitext that includes one or more tables, parse the tables into objects. Exported for testing
 *
 * Wikitable syntax must be in the form of:
 *
 * ```
 * {| class="wikitable"
 * |-
 * !Header 1!!Header 2!!Header 3
 * |-
 * |Example||Example||Example
 * |}
 * ```
 *
 * Inspired by: https://www.mediawiki.org/wiki/API:Parsing_wikitext#Example_1:_Parse_content_of_a_page
 */
export function parseWikitextTableIntoDatetimeOverrides(wikitext: string): DatetimeOverrides {
  const data: any[][] = [];
  const lines = wikitext.split("|-");

  let currentHeader: string[] = [];

  // assume more than one table in the wikitext. use this index to increment which result to put table
  let tableIndex = 0;

  lines.forEach((line) => {
    let t: any = {};

    const stripped = line.trim();

    if (stripped.match(/^!.*/g)) {
      // every time we find a new header, create a new list of rows for the response
      data[tableIndex] = [];
      currentHeader = stripped
        .slice(1)
        .split("!!")
        .map((s) => s.trim());
    }

    if (stripped.match(/^\|(?!-|}).*/g)) {
      const row = stripped
        .slice(1)
        .split("||")
        .map((s) => s.trim());
      row.forEach(
        (cell, index) => (t[currentHeader[index]] = cell.split("|}")[0].replace(/\n/g, ""))
      );
    }

    if (!deepEquals(t, {})) {
      data[tableIndex].push(t);
    }

    if (stripped.match(/\|\}/g)) {
      tableIndex += 1;
    }
  });

  return {
    // the first table is the video time fudges
    videoFixes: data[0],
    // the second table maps test events to camera timezones
    testEventTimezones: data[1],
  };
}

export function parseWikitextTableIntoMediaSourceOverrides(
  wikitext: string
): MediaSourceOverride[] {
  const data: any[][] = [];
  const lines = wikitext.split("|-");

  let currentHeader: string[] = [];

  // assume more than one table in the wikitext. use this index to increment which result to put table
  let tableIndex = 0;

  lines.forEach((line) => {
    let t: any = {};

    const stripped = line.trim();

    if (stripped.match(/^!.*/g)) {
      // every time we find a new header, create a new list of rows for the response
      data[tableIndex] = [];
      currentHeader = stripped
        .slice(1)
        .split("!!")
        .map((s) => s.trim());
    }

    if (stripped.match(/^\|(?!-|}).*/g)) {
      const row = stripped
        .slice(1)
        .split("||")
        .map((s) => s.trim());
      row.forEach(
        (cell, index) => (t[currentHeader[index]] = cell.split("|}")[0].replace(/\n/g, ""))
      );
    }

    if (!deepEquals(t, {})) {
      data[tableIndex].push(t);
    }

    if (stripped.match(/\|\}/g)) {
      tableIndex += 1;
    }
  });

  return data[0] as MediaSourceOverride[];
}

export function parseWikitextTableIntoAncillaryDataSources(
  wikitext: string
): AncillaryDataSource[] {
  const data: any[][] = [];
  const lines = wikitext.split("|-");

  let currentHeader: string[] = [];

  // assume more than one table in the wikitext. use this index to increment which result to put table
  let tableIndex = 0;

  lines.forEach((line) => {
    let t: any = {};

    const stripped = line.trim();

    if (stripped.match(/^!.*/g)) {
      // every time we find a new header, create a new list of rows for the response
      data[tableIndex] = [];
      currentHeader = stripped
        .slice(1)
        .split("!!")
        .map((s) => s.trim());
    }

    if (stripped.match(/^\|(?!-|}).*/g)) {
      const row = stripped
        .slice(1)
        .split("||")
        .map((s) => s.trim());
      row.forEach(
        (cell, index) => (t[currentHeader[index]] = cell.split("|}")[0].replace(/\n/g, ""))
      );
    }

    if (!deepEquals(t, {})) {
      data[tableIndex].push(t);
    }

    if (stripped.match(/\|\}/g)) {
      tableIndex += 1;
    }
  });

  return data[0] as AncillaryDataSource[];
}
