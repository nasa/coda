/*
Server-side implementations for hitting the ISS Wiki directly. Caches responses whenever possible. Only use this code within `getStaticProps()` or `getServerSideProps()` functions

See sandboxes:
* ISS: https://wiki.jsc.nasa.gov/iss/index.php/Special:ApiSandbox#action=ask&format=json
* Exploration: https://wiki.jsc.nasa.gov/exploration/index.php/Special:ApiSandbox#action=ask&format=json&query=
*/
import { promises as fs } from "fs";
import get from "lodash/get";
import deepEquals from "lodash/isEqual";
import memoize from "lodash/memoize";
import MWBot from "mwbot";
import { FileCookieStore } from "tough-cookie-file-store";
import request from "request";
import fetchWithCache from "./cache-client";
import { formatEVADisplayTitle, padZeros } from "utils/formatting";
import gpxParser from "gpxparser";
import { Collection, SequenceType } from "utils/enums";

const COOKIE_JAR = `.cache/cookies-wiki-${process.env.NEXT_PUBLIC_APP_ENV}.json`;

/** Get a read-only "bot" for the wiki */
async function _getMWBot(wiki: string) {
  const apiUrl = `${process.env.WIKI_BASE_URL}/${wiki}/api.php`;
  const bot = new MWBot({
    apiUrl,
    verbose: true,
    silent: false,
  });

  // make sure the cookie jar file exists
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

  return bot;
}

/** Memoized get of a read-only "bot" for the wiki */
const getMWBot = memoize(_getMWBot);

/**
 * Load mock data from this repo
 */
async function mockData(_query: string, action: string): Promise<WikiResults> {
  console.log(`Mocking request for: ${action}...`);

  switch (action) {
    case "getAllEVAs":
      const getAllEVAsMockData = require("/mocks/fakedata/getAllEVAs.json");
      return await Promise.resolve(getAllEVAsMockData);
    case "getAllAsExecuted":
      const getAllAsExecutedMockData = require("/mocks/fakedata/getAllAsExecuted.json");
      return await Promise.resolve(getAllAsExecutedMockData);
    case "getAllCrew":
      const getAllCrewMockData = require("/mocks/fakedata/getAllCrew.json");
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

  const isLocal = process.env.NEXT_PUBLIC_APP_ENV === "local";

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
        console.error("Wiki login unsuccessful");
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
    [[~US EVA*]]
    [[EVA Classification::Scheduled or Historical]]
    |? EVA title
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
  const res = {};

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
      colorString = colorTranslator[colorString];
    } else {
      console.error("color not found: " + colorString);
    }
    const activity: Activity = {
      content: results[r].printouts["Has text title"][0].replace("[[", "").replace("]]", ""),
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
    res[formattedEVAName][actor] = name;
  });

  return res;
}

/** Fetch as-planned and as-executed EVA data and standardize the format */
export async function getAllEVAData(): Promise<WikibotResponse<Sequence[]>> {
  let mocked = false;
  const retriever = async () => {
    const { data: allEVAs, mocked: allEVAsMocked } = await getAllEVAs();
    const { data: asExecuted, mocked: asExecutedMocked } = await getAllAsExecuted();
    const { data: crews, mocked: crewsMocked } = await getAllCrew();

    mocked = allEVAsMocked || asExecutedMocked || crewsMocked;

    return Object.keys(allEVAs).map((evaName) => {
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
        descriptiveTitle: allEVAs[evaName].printouts["EVA title"][0],
        pageName: evaName,
      });

      return {
        /** EVA name upper-cased with spaces, eg. `US EVA 55` */
        name: evaName,
        location: Collection.ISS,
        type: SequenceType.EVA,
        dataURL: allEVAs[evaName].fullurl,
        displayTitle,
        startDate,
        startTime: allEVAs[evaName].printouts["Start time"][0],
        duration,
        asPerformed: get(asExecuted, evaName, { EV1: [], EV2: [] }),
        crew: get(crews, formattedEVAName, { EV1: "Unknown", EV2: "Unknown", SUIT_IV: "Unknown" }),
      };
    });
  };

  const response = await fetchWithCache<Sequence[]>("wiki/all", retriever, {
    cacheAge: 60,
    staleOk: true,
  });
  if (mocked) {
    response.cacheMetadata.mocked = true;
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
export async function getAllTestEventsData(): Promise<WikibotResponse<Sequence[]>> {
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
        "Unknown environment"
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

      const displayTitle = `${startDate} ${testEnvironment} / ${flightEnvironment}`;

      const rawStartTime = get(
        allTestEvents[testEvent].printouts["UTC Start Date Time"],
        "[0]",
        " 00:00"
      );
      const startTime = rawStartTime.split(" ")[1];

      return {
        name: testEvent,
        location: Collection[Collection[testEnvironment]],
        type: SequenceType.testing,
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

  const response = await fetchWithCache<Sequence[]>("wiki/test-events", retriever, {
    cacheAge: 60,
    staleOk: true,
  });
  if (mocked) {
    response.cacheMetadata.mocked = true;
  }
  return response;
}

export async function fetchSequences(collection: Collection): Promise<WikibotResponse<Sequence[]>> {
  if (collection === Collection.ISS) {
    return getAllEVAData();
  } else {
    return getAllTestEventsData();
  }
}

/** Get list of GPS tracks available in the wiki */

async function fetchWikiGPSList(): Promise<WrappedResponse<string[]>> {
  const parseQuery = {
    page: "CODA/D-RATS_2021_Data", //TODO: Rename these wiki pages to something general instead of "D-RATS"
    prop: "links",
  };

  const retriever = async () => {
    const res = await fetchWiki({
      parseQuery,
      wiki: "exploration",
      action: "parse",
    });
    const links = [];
    for (let i = 0; i < res.data.parse.links.length; i++) {
      const link = res.data.parse.links[i]["*"];
      links.push(link);
    }
    return links;
  };

  return await fetchWithCache<string[]>("wiki/gps-list", retriever, {
    cacheAge: 60, // 60 seconds
    staleOk: true,
    preferNew: false,
  });
}

export async function fetchWikiGPSTracks(dateWanted: string): Promise<WrappedResponse<GPSTrack[]>> {
  const gpsList = await fetchWikiGPSList();
  let error = null;
  // Find all of the GPS wiki pages that match the date and get the GPX out of each of them
  const regexStr = `.*${dateWanted}\/GPS\/(.*)`;
  const gpsTracks: GPSTrack[] = [];
  for (let i = 0; i < gpsList.data.length; i++) {
    const match = gpsList.data[i].match(regexStr);
    if (match) {
      if (
        match[1] === "EV1" ||
        match[1] === "EV2" ||
        match[1] === "Cart" ||
        match[1] === "LightCart"
      ) {
        const gpsTrackRes = await fetchWikiGPSTrack(gpsList.data[i], match[1]);
        if (gpsTrackRes.cacheMetadata.error !== undefined) {
          error = gpsTrackRes.cacheMetadata.error;
        }
        gpsTracks.push(gpsTrackRes.data);
      }
    }
  }
  return { cacheMetadata: { ...gpsList.cacheMetadata, ...error }, data: gpsTracks };
}

async function fetchWikiGPSTrack(
  pageName: string,
  name: string
): Promise<WrappedResponse<GPSTrack>> {
  const parseQuery = {
    page: pageName,
    prop: "wikitext",
  };

  const retriever = async () => {
    const res = await fetchWiki({
      parseQuery,
      wiki: "exploration",
      action: "parse",
    });

    // parse the gpx XML retreived from the wiki
    var gpx = new gpxParser();
    gpx.parse(res.data.parse.wikitext["*"]);

    //replace any slope null values with 0
    for (let i = 0; i < gpx.tracks[0].slopes.length; i++) {
      if (gpx.tracks[0].slopes[i] === null) {
        gpx.tracks[0].slopes[i] = 0;
      }
    }

    //store only the GPS data portions we want
    const track: GPSTrack = {
      name: name,
      points: gpx.tracks[0].points,
      slopes: gpx.tracks[0].slopes,
    };

    return track;
  };

  return await fetchWithCache<GPSTrack>(`wiki/gps/${pageName}`, retriever, {
    cacheAge: 604800, // 604800 seconds = 1 week
    staleOk: true,
    preferNew: false,
  });
}

/** Get all the manually set shifts for fixing datetimes.
 *
 * Data lives here: https://wiki.jsc.nasa.gov/exploration/index.php/CODA/Datetime_Shifts
 */
export async function fetchDatetimeOverrides(): Promise<WrappedResponse<DatetimeOverrides>> {
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
    return parseWikitextTable(res.data.parse.wikitext["*"]);
  };

  return await fetchWithCache<DatetimeOverrides>("wiki/datetime-overrides", retriever, {
    cacheAge: 60,
    staleOk: true,
    preferNew: false,
  });
}

/** Given wikitext that includes one or more tables, parse the tables into objects
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
function parseWikitextTable(wikitext: string): DatetimeOverrides {
  const data = [];
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
