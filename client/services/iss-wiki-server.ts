/*
Server-side implementations for hitting the ISS Wiki directly. Caches responses whenever possible. Only use this code within `getStaticProps()` or `getServerSideProps()` functions
*/
import crypto from "crypto";
import { promises as fs } from "fs";
import isNull from "lodash/isNull";
import memoize from "lodash/memoize";
import MWBot from "mwbot";
import FileCookieStore from "tough-cookie-filestore";
import request from "request";
import fetch from "isomorphic-unfetch";
import { WikiResponse, WikiResults } from "services/iss-wiki";

const COOKIE_JAR =
  process.env.NEXT_PUBLIC_APP_ENV === "dev"
    ? "services/.cookies-dev.json"
    : "services/.cookies-prod.json";

// wiki.jsc.nasa.gov uses a NOCA cert. We need to tell Node to use system certs on Mac and Windows. Node on Linux uses system certs by default. see the discussion/complaints here https://github.com/nodejs/node/issues/3159#issuecomment-477295118
require("mac-ca");
require("win-ca");

// to be clear, we're not hashing sensitive data, just filenames
const hash = crypto.createHash("md5");

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
 * Perform an ask against the wiki API
 */
async function performAsk(bot: MWBot, query: string): Promise<WikiResults> {
  hash.update(process.env.WIKI_API_URL + query);
  const cacheFile = `./.cache/${hash.copy().digest("hex")}.json`;

  let res = null as WikiResults;
  let cachedRes = null as string;

  // either hit the cache or hit the network
  try {
    cachedRes = await fs.readFile(cacheFile, { encoding: "utf-8" });
  } catch (e) {
    try {
      res = await bot.request({ action: "ask", format: "json", query });
    } catch (e) {
      // the request failed. we may not be logged in or something else is wrong
      // let the caller decide what to do
      throw e;
    }
  }

  // we hit the cache. turn it into valid WikiResults
  if (!isNull(cachedRes)) {
    try {
      res = JSON.parse(cachedRes);
    } catch (e) {
      console.error("Could not parse cache file");
      throw e;
    }
  }

  // we hit the network. cache the results for later
  if (isNull(cachedRes)) {
    try {
      // make sure the cache directory exists firsts
      await fs.mkdir("./.cache", { recursive: true });
      // write to the cache
      await fs.writeFile(cacheFile, JSON.stringify(res));
    } catch (e) {
      console.error("Could not cache wiki results");
      console.error(e);
    }
  }

  return res;
}

/** Checks if the response from the wiki mean we aren't logged in */
function isAPIError(e: any | WikiResponse): e is WikiResponse {
  return e.errorResponse && e.code === "readapidenied";
}

export default async function serverFetch(query: string, action?: string): Promise<WikiResults> {
  let res: WikiResults;

  const isLocal = process.env.NEXT_PUBLIC_APP_ENV === "local";

  // we're in the local environment. fake the request using a mock service worker
  if (isLocal) {
    const res = await fetch(process.env.WIKI_API_URL, {
      headers: {
        "X-MOCK-ACTION": action,
      },
    });
    return res.json();
  }

  const bot = await getMWBot();

  try {
    // optmistically try to fetch from the wiki before we know for sure we're logged in
    res = await performAsk(bot, query);
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
      res = await performAsk(bot, query);
    } catch (e) {
      console.error("Wiki request error");
      throw e;
    }
  }

  return res;
}
