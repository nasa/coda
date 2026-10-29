import fs from "node:fs";
import https from "node:https";
import tls from "node:tls";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { NtlmClient } = require("axios-ntlm");
const root = new URL("../../", import.meta.url);
const dir = new URL(".local/optimis-gantt/", root);
if (process.argv.includes("--help")) {
  console.log(
    "Usage: node scripts/optimis/fetch.mjs [YYYY-MM-DD] [--refresh]\nFetch one UTC day from production into .local/optimis-gantt/data.\nReads .local/optimis-probe.credentials.json and .env.local.cert.pem."
  );
  process.exit(0);
}
const date =
  process.argv[2] && !process.argv[2].startsWith("--")
    ? process.argv[2]
    : new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) throw new Error("Expected YYYY-MM-DD");
const start = new Date(`${date}T00:00:00Z`);
if (!Number.isFinite(+start) || start.toISOString().slice(0, 10) !== date)
  throw new Error("Invalid date");
const end = new Date(+start + 86400000);
const metadataFile = new URL(`data/metadata-${date}.json`, dir);
fs.mkdirSync(new URL("data/", dir), { recursive: true });
if (!process.argv.includes("--refresh") && fs.existsSync(metadataFile)) {
  const saved = JSON.parse(fs.readFileSync(metadataFile, "utf8"));
  const filesExist = ["activities", "profiles"].every((kind) =>
    fs.existsSync(new URL(`data/${kind}-${date}.json`, dir))
  );
  if (
    filesExist &&
    Date.now() - Date.parse(saved.fetchedAt) >= 0 &&
    Date.now() - Date.parse(saved.fetchedAt) < 900000
  ) {
    console.log("Using the snapshot fetched less than 15 minutes ago.");
    process.exit(0);
  }
}
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
const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 1,
  ca: [...tls.rootCertificates, fs.readFileSync(new URL(".env.local.cert.pem", root), "utf8")],
});
const client = NtlmClient(
  { ...credentials, domain: credentials.domain || "NDC", workstation: "" },
  {
    httpsAgent: agent,
    maxRedirects: 0,
    timeout: 60000,
    maxContentLength: 32 * 1024 * 1024,
    proxy: false,
  }
);
const queries = {
  activities: [
    "activitySearch",
    {
      overlapRange: `startTime=${start.toISOString()},endTime=${end.toISOString()}`,
      keywordQuery: "isTask:false",
      planContext: "ops1",
      maxResults: "-1",
    },
  ],
  profiles: [
    "profilesSearch",
    {
      keywordQuery: "id:DayNight,DAILY_ORB_NUM,ATTITUDE,ALL_KU_AVAIL,ALL_S1_AVAIL,ALL_S2_AVAIL",
      start: start.toISOString(),
      end: end.toISOString(),
      planContext: "ops1",
    },
  ],
};
const metadata = { date, planContext: "ops1", fetchedAt: new Date().toISOString(), requests: [] };
const staged = [];
try {
  for (const [kind, [endpoint, params]] of Object.entries(queries)) {
    const url = new URL(`/planrepository/${endpoint}`, "https://ops.jsc.nasa.gov");
    url.search = new URLSearchParams(params).toString();
    let response;
    try {
      response = await client.get(url.href, { headers: { Accept: "application/json" } });
    } catch (error) {
      throw new Error(
        `${endpoint}: ${error.response ? "HTTP " + error.response.status : error.code || "request failed"}`
      );
    }
    if (!String(response.headers["content-type"]).includes("json"))
      throw new Error(`${endpoint}: expected JSON`);
    const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
    if (kind === "activities" && (!data || !Array.isArray(data.plan)))
      throw new Error("Unrecognized activity response");
    if (kind === "profiles" && !Array.isArray(data))
      throw new Error("Unrecognized profile response");
    const destination = new URL(`data/${kind}-${date}.json`, dir);
    const temporary = new URL(`data/${kind}-${date}.pending`, dir);
    fs.writeFileSync(temporary, JSON.stringify(data));
    staged.push([temporary, destination]);
    metadata.requests.push({ kind, url: url.href, status: response.status });
    console.log(`${endpoint}: HTTP ${response.status}`);
  }
  for (const [temporary, destination] of staged) fs.renameSync(temporary, destination);
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
  console.log(`Saved ${date} UTC / ops1. No automatic upstream polling.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  agent.destroy();
}
