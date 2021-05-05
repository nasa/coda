/*
Server-side implementations for hitting the ISS Wiki directly. Caches responses whenever possible. Only use this code within `getStaticProps()` or `getServerSideProps()` functions
*/
import { promises as fs } from "fs";
import get from "lodash/get";
import memoize from "lodash/memoize";
import MWBot from "mwbot";
import FileCookieStore from "tough-cookie-filestore";
import request from "request";
import type {
  WikiResults,
  WikiResponse,
  Activity,
  AllCrews,
  AllExecution,
  EVAAsExecuted,
  EVACrewResults,
  EVASummaryResponse,
} from "typings/wiki";
import fetchWithCache from "./cache-client";
import type { WrappedResponse } from "typings";

const COOKIE_JAR = `server/.cookies-wiki-${process.env.NEXT_PUBLIC_APP_ENV}.json`;

/** Get a read-only "bot" for the wiki */
async function _getMWBot() {
  const apiUrl = process.env.WIKI_API_URL;
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
      const getAllEVAsMockData = require("../mocks/fakedata/getAllEVAs.json");
      return await Promise.resolve(getAllEVAsMockData);
    case "getAllAsExecuted":
      const getAllAsExecutedMockData = require("../mocks/fakedata/getAllAsExecuted.json");
      return await Promise.resolve(getAllAsExecutedMockData);
    case "getAllCrew":
      const getAllCrewMockData = require("../mocks/fakedata/getAllCrew.json");
      return await Promise.resolve(getAllCrewMockData);
    default:
      console.error(`Unknown Wiki request action: '${action}'`);
      return await Promise.resolve(null);
  }
}

/** Checks if the response from the wiki mean we aren't logged in */
function isAPIError(e: any | WikiResponse): e is WikiResponse {
  return e.errorResponse && e.code === "readapidenied";
}

/**
 * Perform a query against the wiki. Returns a cached result if this query has already been performed
 * @param query Wikimedia query string
 * @param action Optional action type for local mocking
 */
async function fetchWiki(query: string, action?: string): Promise<WrappedResponse<WikiResults>> {
  const isLocal = process.env.NEXT_PUBLIC_APP_ENV === "local";

  // we're in the local environment. fake the request
  if (isLocal) {
    const data = await mockData(query, action);
    return {
      data,
      mocked: true,
    };
  }

  let res: WrappedResponse<WikiResults>;

  const bot = await getMWBot();
  /** Use the MWBot to perform an ask request against the wiki */
  const retriever = async () => await bot.request({ action: "ask", format: "json", query });

  try {
    // optmistically try to fetch from the wiki before we know for sure we're logged in
    res = await fetchWithCache<WikiResults>(`wiki/${query}`, retriever);
  } catch (e) {
    if (isAPIError(e)) {
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
      res = await fetchWithCache<WikiResults>(`wiki/${query}`, retriever, {
        staleOk: true,
      });
    } catch (e) {
      console.error("Wiki request error");
      throw e;
    }
  }

  return res;
}

/** Get a summary of all EVAs on the wiki */
export async function getAllEVAs(): Promise<EVASummaryResponse> {
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
  const res = await fetchWiki(query, "getAllEVAs");
  return res.data.query.results;
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
export async function getAllAsExecuted(): Promise<AllExecution> {
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

  // TODO: use retriever here instead
  const res = await fetchWiki(query, "getAllAsExecuted");
  const results: EVAAsExecuted = res.data.query.results;
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

/** The proxy needs the `+` in the query to get pre-encoded as `%2B`, while MWBot wants it as a `+` */
const plus = () => {
  return typeof window !== "undefined" ? "%2B" : "+";
};

/** Get crew assignment data for all EVAs */
export async function getAllCrew(): Promise<AllCrews> {
  const query = `
    [[Crew involved with subject::${plus()}]]
    [[From page::~US EVA*]]
    |? Has full name
    |? Has role
    |? Has EMU Page
    |limit=10000
  `;
  const res = await fetchWiki(query, "getAllCrew");
  const results: EVACrewResults = res.data.query.results;
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
