import fs from "node:fs";
import https from "node:https";
import tls from "node:tls";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ntlm = require("axios-ntlm/lib/ntlm.js");

const root = new URL("../../", import.meta.url);
if (process.argv.includes("--help")) {
  console.log(
    "Usage: node scripts/optimis/probe.mjs [--environment production|integration] [--date YYYY-MM-DD] [--negotiation-only | --authenticate] [--dictionary-only]\nDefault: integration, anonymous probes and credential-free NTLM negotiation.\nReports and successful responses are saved under .local/optimis-gantt/probes/<environment>/."
  );
  process.exit(0);
}
const environmentIndex = process.argv.indexOf("--environment");
const environment = environmentIndex < 0 ? "integration" : process.argv[environmentIndex + 1];
const hosts = { production: "https://ops.jsc.nasa.gov", integration: "https://int.jsc.nasa.gov" };
if (!Object.hasOwn(hosts, environment)) throw new Error("Choose production or integration");
const origin = hosts[environment];
const directory = new URL(`.local/optimis-gantt/probes/${environment}/`, root);
if (process.argv.includes("--negotiation-only") && process.argv.includes("--authenticate"))
  throw new Error("Choose only one authentication mode");
const dateIndex = process.argv.indexOf("--date");
const date = dateIndex < 0 ? new Date().toISOString().slice(0, 10) : process.argv[dateIndex + 1];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) throw new Error("Expected --date YYYY-MM-DD");
const startDate = new Date(`${date}T00:00:00Z`);
if (!Number.isFinite(+startDate) || startDate.toISOString().slice(0, 10) !== date)
  throw new Error("Invalid date");
const start = `${date}T00:00:00Z`;
const end = new Date(+startDate + 86400000).toISOString();
fs.mkdirSync(directory, { recursive: true });
const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 1,
  ca: [...tls.rootCertificates, fs.readFileSync(new URL(".env.local.cert.pem", root), "utf8")],
});
const endpoints = [
  ["dictionary", "/planrepository/dictionary", {}],
  [
    "activities",
    "/planrepository/activitySearch",
    {
      overlapRange: `startTime=${start},endTime=${end}`,
      keywordQuery: "isTask:false",
      planContext: "ops1",
      maxResults: "-1",
    },
  ],
  [
    "profiles",
    "/planrepository/profilesSearch",
    {
      keywordQuery: "id:DayNight,DAILY_ORB_NUM,ATTITUDE,ALL_KU_AVAIL,ALL_S1_AVAIL,ALL_S2_AVAIL",
      start,
      end,
      planContext: "ops1",
    },
  ],
  ["viewer", "/Gateway/index", { program: "iss", site: "ops1" }],
  [
    "dictionary-ntlm-negotiation",
    "/planrepository/dictionary",
    {},
    { Authorization: ntlm.createType1Message("", "") },
  ],
];

function get(url, extraHeaders = {}) {
  if (url.origin !== origin) throw new Error("Probe is restricted to the selected origin");
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        agent,
        headers: {
          Accept: "application/json, application/xml;q=0.9, text/xml;q=0.9, text/html;q=0.8",
          ...extraHeaders,
        },
      },
      (response) => {
        const chunks = [];
        let size = 0;
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > 32 * 1024 * 1024) response.destroy(new Error("Response exceeds probe limit"));
          else chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          })
        );
      }
    );
    request.setTimeout(30000, () => request.destroy(new Error("Request timed out")));
    request.on("error", reject);
  });
}

const report = {
  origin,
  date,
  authentication: "none; no credentials or existing session supplied",
  fetchedAt: new Date().toISOString(),
  results: [],
};
const authenticatedMode = process.argv.includes("--authenticate");
if (authenticatedMode)
  report.authentication =
    "Preemptive NTLM; credentials loaded locally only after an NTLM challenge";
async function authenticate(url) {
  const challengeResponse = await get(url, { Authorization: ntlm.createType1Message("", "") });
  const header = challengeResponse.headers["www-authenticate"];
  if (challengeResponse.status !== 401 || !/^NTLM\s+[A-Za-z0-9+/=]+/.test(header || ""))
    return challengeResponse;
  const challenge = ntlm.decodeType2Message(header);
  const advertisedDomain = challenge.targetInfo?.parsed?.DOMAIN || challenge.targetName;
  if (!advertisedDomain) throw new Error("No server-advertised NTLM domain");
  let credentials;
  try {
    credentials = JSON.parse(
      fs.readFileSync(new URL(".local/optimis-probe.credentials.json", root), "utf8")
    );
  } catch {
    throw new Error("Unable to read the local credentials file as JSON");
  }
  if (
    typeof credentials?.username !== "string" ||
    !credentials.username ||
    typeof credentials.password !== "string" ||
    !credentials.password ||
    (credentials.domain !== undefined && typeof credentials.domain !== "string")
  ) {
    throw new Error("Credentials require string username, password, and optional domain");
  }
  const response = await get(url, {
    Authorization: ntlm.createType3Message(
      challenge,
      credentials.username,
      credentials.password,
      "",
      credentials.domain || advertisedDomain
    ),
  });
  response.advertisedDomain = advertisedDomain;
  return response;
}
try {
  const selected = endpoints
    .filter((x) =>
      authenticatedMode
        ? ["dictionary", "activities", "profiles"].includes(x[0])
        : !process.argv.includes("--negotiation-only") || x[0] === "dictionary-ntlm-negotiation"
    )
    .filter(
      (x) => !process.argv.includes("--dictionary-only") || x[1] === "/planrepository/dictionary"
    );
  for (const [kind, path, params, extraHeaders] of selected) {
    const url = new URL(path, origin);
    url.search = new URLSearchParams(params).toString();
    try {
      const response = authenticatedMode ? await authenticate(url) : await get(url, extraHeaders);
      const result = {
        kind,
        url: url.href,
        status: response.status,
        contentType: response.headers["content-type"],
        characters: response.body.length,
        authentication: response.headers["www-authenticate"]
          ?.split(",")
          .map((x) => x.trim().split(" ")[0]),
      };
      if (response.advertisedDomain) result.advertisedDomain = response.advertisedDomain;
      const ntlmHeader = response.headers["www-authenticate"];
      if (
        !authenticatedMode &&
        response.status === 401 &&
        /^NTLM\s+[A-Za-z0-9+/=]+/.test(ntlmHeader || "")
      ) {
        const challenge = ntlm.decodeType2Message(ntlmHeader);
        result.advertisedDomain = challenge.targetInfo?.parsed?.DOMAIN || challenge.targetName;
        result.dnsDomain = challenge.targetInfo?.parsed?.DNS;
      }
      if (response.headers.location) {
        const destination = new URL(response.headers.location, url);
        result.redirect = destination.origin + destination.pathname;
        result.redirectParameters = [...new Set(destination.searchParams.keys())];
        result.responseType = destination.searchParams.get("response_type") || undefined;
        const callback = destination.searchParams.get("redirect_uri");
        if (callback) {
          const target = new URL(callback);
          result.callback = target.origin + target.pathname;
        }
      }
      if (response.status === 200) {
        if (
          response.body.trimStart().startsWith("{") ||
          response.body.trimStart().startsWith("[")
        ) {
          try {
            const data = JSON.parse(response.body);
            result.jsonRoot = Array.isArray(data) ? "array" : Object.keys(data);
            if (kind === "activities") result.planCount = data.plan?.length;
            if (kind === "profiles")
              result.profileCount = Array.isArray(data) ? data.length : undefined;
            const filename = `${kind}-${date}.json`;
            fs.writeFileSync(new URL(filename, directory), response.body);
            result.file = filename;
          } catch {
            result.jsonError = "Not valid JSON";
          }
        } else if (kind === "dictionary" && response.body.includes("<Dictionary ")) {
          const filename = `dictionary-${date}.xml`;
          fs.writeFileSync(new URL(filename, directory), response.body);
          result.file = filename;
        } else result.bodyKind = "Unexpected content; not saved";
      }
      report.results.push(result);
      console.log(JSON.stringify(result));
      if (response.status === 429 || (authenticatedMode && [401, 403].includes(response.status)))
        break;
    } catch (error) {
      const result = { kind, url: url.href, error: error.code || error.message };
      report.results.push(result);
      console.log(JSON.stringify(result));
    }
  }
  const mode = authenticatedMode
    ? "authenticated"
    : process.argv.includes("--negotiation-only")
      ? "negotiation"
      : "unauthenticated";
  fs.writeFileSync(new URL(`results-${mode}.json`, directory), JSON.stringify(report, null, 2));
} finally {
  agent.destroy();
}
