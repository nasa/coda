/**
 * Seeds photo_time_shifts_db with Artemis 2 per-camera timezone corrections
 * by calling the CODA REST API instead of writing to the DB directly.
 *
 * This approach works in any environment where the API is running.
 *
 * Camera timezone analysis (calibrated against known event times):
 *   nhq       → KSC photographers, cameras set to EDT (UTC-4)
 *   jsc2026e  → JSC photographers, cameras set to CDT (UTC-5)
 *   art002e   → Onboard Orion cameras, already UTC (no correction)
 *
 * Usage:
 *   node src/server/processing/artemis2/seed-photo-timeshifts-api.mjs
 *   node src/server/processing/artemis2/seed-photo-timeshifts-api.mjs --url https://coda-int.fit.nasa.gov
 *   node src/server/processing/artemis2/seed-photo-timeshifts-api.mjs --url https://coda-int.fit.nasa.gov --cookie "_oauth2_proxy=..."
 *
 * In local dev (MOCK_USER=true), no --cookie is needed.
 * In real environments, pass the _oauth2_proxy session cookie from your browser.
 */

const API_PATH = "/api/v1/db/photoTimeShifts";

const records = [
  // NHQ photographers at KSC (EDT = UTC-4), launch day only
  { date: "2026-04-01", source: "ARTEMIS", nasaIdRegex: "^nhq", timeOffset: "-04:00:00" },

  // JSC photographers (CDT = UTC-5), all mission days with JSC photos
  { date: "2026-04-01", source: "ARTEMIS", nasaIdRegex: "^jsc2026e", timeOffset: "-05:00:00" },
  { date: "2026-04-02", source: "ARTEMIS", nasaIdRegex: "^jsc2026e", timeOffset: "-05:00:00" },
  { date: "2026-04-03", source: "ARTEMIS", nasaIdRegex: "^jsc2026e", timeOffset: "-05:00:00" },
  { date: "2026-04-05", source: "ARTEMIS", nasaIdRegex: "^jsc2026e", timeOffset: "-05:00:00" },
  { date: "2026-04-06", source: "ARTEMIS", nasaIdRegex: "^jsc2026e", timeOffset: "-05:00:00" },
  { date: "2026-04-08", source: "ARTEMIS", nasaIdRegex: "^jsc2026e", timeOffset: "-05:00:00" },
  { date: "2026-04-09", source: "ARTEMIS", nasaIdRegex: "^jsc2026e", timeOffset: "-05:00:00" },
  { date: "2026-04-10", source: "ARTEMIS", nasaIdRegex: "^jsc2026e", timeOffset: "-05:00:00" },
  { date: "2026-04-11", source: "ARTEMIS", nasaIdRegex: "^jsc2026e", timeOffset: "-05:00:00" },
];

// Parse CLI args: --url <base> --cookie <value>
const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
};

const baseUrl = getArg("--url") ?? "http://coda-local.fit.nasa.gov:3000";
const cookie = getArg("--cookie");

const headers = { "Content-Type": "application/json" };
if (cookie) headers["Cookie"] = cookie;

async function apiGet(path) {
  const res = await fetch(`${baseUrl}${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  console.log(`Target: ${baseUrl}${API_PATH}\n`);

  // Fetch all existing records to check for duplicates
  const existing = await apiGet(API_PATH);
  console.log(`Found ${existing.length} existing record(s)\n`);

  let inserted = 0;
  let skipped = 0;

  for (const rec of records) {
    const duplicate = existing.find(
      (e) => e.date === rec.date && e.source === rec.source && e.nasaIdRegex === rec.nasaIdRegex
    );

    if (duplicate) {
      console.log(`  SKIP  ${rec.date} | ${rec.source} | ${rec.nasaIdRegex} | ${rec.timeOffset} (id=${duplicate.id})`);
      skipped++;
      continue;
    }

    await apiPost(API_PATH, rec);
    console.log(`  ADD   ${rec.date} | ${rec.source} | ${rec.nasaIdRegex} | ${rec.timeOffset}`);
    inserted++;
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} skipped`);
}

main().catch((e) => {
  console.error("\nError:", e.message);
  process.exit(1);
});
