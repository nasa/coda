/*
Server-side implementations for hitting the ISS Wiki directly. Caches responses whenever possible.

See sandboxes:
* ISS: https://wiki.jsc.nasa.gov/iss/index.php/Special:ApiSandbox#action=ask&format=json
* Exploration: https://wiki.jsc.nasa.gov/exploration/index.php/Special:ApiSandbox#action=ask&format=json&query=
*/
import fs from "fs";
import get from "lodash/get";
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
      // console.error("Wiki request error");
      throw e;
    }
    // we are logged in now. retry the request
    try {
      res = await bot.request(payload);
    } catch (e) {
      // console.error("Wiki request error");
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
  const res = await fetchWiki({ askQuery, wiki: "iss" });
  const results: EVASummaryResponse = res.data.query.results;

  return {
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
  const res = await fetchWiki({ askQuery, wiki: "iss" });
  const results = parseAllAsExecuted(res.data.query.results);

  return {
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

  const res = await fetchWiki({ askQuery, wiki: "iss" });
  const results: AllCrews = parseAllCrew(res.data.query.results);
  return {
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
): Promise<WrappedResponse<Sequence[]>> {
  const retriever = async () => {
    const { data: allEVAs } = await getAllEVAs();
    const { data: asExecuted } = await getAllAsExecuted();
    const { data: crews } = await getAllCrew();

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
  });
  const results: AllTestEvents = res.data.query.results;

  return {
    data: results,
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
  });
  const results: AllExecution = parseAllAsExecuted(res.data.query.results);

  return {
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
  });
  const results: AllCrews = parseAllCrew(res.data.query.results);

  return {
    data: results,
  };
}

/** Fetch as-planned and as-executed EVA data and standardize the format */
export async function getAllTestEventsData(
  forceNew: boolean = false
): Promise<WrappedResponse<Sequence[]>> {
  const retriever = async () => {
    const { data: allTestEvents } = await getAllTestEvents();
    const { data: asExecuted } = await getTestEventExecution();
    const { data: crews } = await getTestEventCrews();

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
        location: collection.TEST_EVENTS,
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
  return response;
}

export async function fetchSequences(
  source: Source,
  forceNew: boolean = false
): Promise<WrappedResponse<Sequence[]>> {
  if (source === "ISS") {
    return getAllEVAData("us", forceNew);
  } else {
    return getAllTestEventsData(forceNew);
  }
}
