/**
 * Scrapes EXIF metadata from IO individual photo pages for Artemis 2 photos.
 *
 * The IO search API does NOT return EXIF fields like Digital Creation Time
 * (which includes the timezone offset), camera model, or photographer.
 * These are visible on individual photo info pages (info.cfm?pid=XXXXX).
 *
 * This script:
 * 1. Fetches all Artemis 2 mission-day photos from the IO search API
 * 2. Scrapes each photo's info page to extract EXIF metadata
 * 3. Writes results to src/server/processing/artemis2/photo-exif-metadata.json
 * 4. Prints a summary grouped by date + timezone offset + camera
 *
 * Usage: node src/server/processing/artemis2/scrape-io-photo-metadata.mjs
 *
 * Requires IO_KEY in .env file.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// IO uses an internal NASA CA not trusted by Node's default CA bundle.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../../../..");

// Load IO_KEY from .env
const envContent = readFileSync(resolve(ROOT, ".env"), "utf-8");
const ioKeyMatch = envContent.match(/IO_KEY="([^"]+)"/);
if (!ioKeyMatch) {
  console.error("IO_KEY not found in .env");
  process.exit(1);
}
const IO_KEY = ioKeyMatch[1];
const IO_HOST = "https://io.jsc.nasa.gov";
const IO_API_URL = `${IO_HOST}/api/search/rpp=500`;
const ARTEMIS2_PHOTO_COLLECTION = 2346894;

// Mission date range: April 1-13, 2026
const START_DATE = "04-01-2026";
const END_DATE = "04-13-2026";

const CONCURRENCY = 10;

async function fetchIO(params) {
  const url = `${IO_API_URL}&${params}?key=${IO_KEY}&format=json`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Origin: "https://coda.fit.nasa.gov",
    },
  });
  return res.json();
}

async function fetchAllPhotos() {
  const baseParams = `s_dt=${START_DATE}&e_dt=${END_DATE}&cols=${ARTEMIS2_PHOTO_COLLECTION}&as=1&so=7`;
  const first = await fetchIO(baseParams);
  const numfound = first.results?.response?.numfound ?? 0;
  console.log(`Total photos found: ${numfound}`);

  const docs = [...(first.results?.response?.docs ?? [])];
  const pages = Math.ceil(numfound / 500);

  for (let i = 1; i < pages; i++) {
    const sr = i * 500 + 1;
    const res = await fetchIO(`${baseParams}&sr=${sr}`);
    docs.push(...(res.results?.response?.docs ?? []));
    console.log(`  Fetched page ${i + 1}/${pages} (${docs.length} total)`);
  }

  return docs;
}

/**
 * Scrape EXIF metadata from an individual photo info page.
 *
 * The camera data section is a two-column table where:
 *   <td class="nowrap">FieldName            </td>
 *   <td width="100%"> value</td>
 *
 * We extract ALL key-value pairs generically, then pick the fields we need.
 */
async function scrapeMetadataForDoc(doc) {
  const pid = doc.id;
  const url = `${IO_HOST}/app/info.cfm?pid=${pid}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "text/html" },
      signal: AbortSignal.timeout(15000),
    });
    const html = await res.text();

    // Extract all key-value pairs from the camera data table.
    // Pattern: <td class="nowrap"...>FieldName</td> ... <td ...>Value</td>
    const kvPattern =
      /<td\s+class="nowrap"[^>]*>\s*(\w[\w\s]*?)\s*<\/td>\s*(?:<\/tr>\s*)?<td[^>]*>\s*([\s\S]*?)\s*<\/td>/gi;

    const fields = {};
    let m;
    while ((m = kvPattern.exec(html)) !== null) {
      const key = m[1].trim();
      const val = m[2].replace(/<[^>]+>/g, "").trim();
      if (val && val !== "&nbsp;") {
        fields[key] = val;
      }
    }

    // Derive timezone offset from DigitalCreationTime (e.g. "17:06:20-07:00")
    const dct = fields["DigitalCreationTime"] || fields["TimeCreated"] || null;
    let tzOffset = null;
    if (dct) {
      const tzMatch = dct.match(/([+-]\d{2}:\d{2})$/);
      if (tzMatch) tzOffset = tzMatch[1];
    }

    return {
      nasa_id: doc.nasa_id,
      pid,
      tz_offset: tzOffset,
      exif: fields,
    };
  } catch (e) {
    console.error(`  Error scraping ${pid} (${doc.nasa_id}): ${e.message}`);
    return {
      nasa_id: doc.nasa_id,
      pid,
      tz_offset: null,
      exif: null,
      error: e.message,
    };
  }
}

async function processBatch(docs, startIdx) {
  const batch = docs.slice(startIdx, startIdx + CONCURRENCY);
  return Promise.all(batch.map((doc) => scrapeMetadataForDoc(doc)));
}

// Only scrape ground photos that need timezone correction (jsc2026e, nhq).
// art002e/art002a are onboard cameras already in UTC — skip them.
const SCRAPE_PREFIXES = ["jsc", "nhq"];

async function main() {
  console.log("Fetching Artemis 2 photo list from IO API...");
  const allDocs = await fetchAllPhotos();
  console.log(`\nTotal docs: ${allDocs.length}`);

  // Filter to only ground-photographer prefixes that need scraping
  const docsToScrape = allDocs.filter((doc) =>
    SCRAPE_PREFIXES.some((pfx) => doc.nasa_id.startsWith(pfx))
  );
  console.log(
    `Filtered to ${docsToScrape.length} ground photos (${SCRAPE_PREFIXES.join(", ")}), skipping ${allDocs.length - docsToScrape.length} onboard/other`
  );

  // Scrape EXIF metadata from individual pages
  console.log("\nScraping EXIF metadata from individual photo pages...");
  const results = [];
  let scraped = 0;

  for (let i = 0; i < docsToScrape.length; i += CONCURRENCY) {
    const batchResults = await processBatch(docsToScrape, i);
    results.push(...batchResults);
    scraped += batchResults.length;
    const pct = Math.round((scraped / docsToScrape.length) * 100);
    process.stdout.write(
      `\r  Progress: ${scraped}/${docsToScrape.length} (${pct}%)`
    );
  }
  console.log();

  // Build scraped metadata lookup
  const metadataMap = {};
  for (const r of results) {
    metadataMap[r.nasa_id] = r;
  }

  // Build output: scraped photo metadata with EXIF data
  const output = docsToScrape.map((doc) => {
    const nid = doc.nasa_id;
    const scraped = metadataMap[nid] || {};

    // Extract date from md_creation_date
    const dateMatch = doc.md_creation_date?.match(/^(\d{4}-\d{2}-\d{2})/);

    return {
      nasa_id: nid,
      pid: doc.id,
      date: dateMatch ? dateMatch[1] : null,
      md_creation_date: doc.md_creation_date,
      tz_offset: scraped.tz_offset || null,
      exif: scraped.exif || null,
      collections_string: doc.collections_string,
    };
  });

  // Sort by nasa_id
  output.sort((a, b) => a.nasa_id.localeCompare(b.nasa_id));

  const outputPath = resolve(__dirname, "photo-exif-metadata.json");
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${output.length} entries to ${outputPath}`);

  // ── Summary ──────────────────────────────────────────────────────
  printSummary(output);
}

function printSummary(output) {
  // Group by nasa_id prefix (jsc2026e, nhq, art002e, etc.)
  const byPrefix = {};
  for (const p of output) {
    const prefix = p.nasa_id.match(/^[a-z]+\d*/i)?.[0] || "unknown";
    if (!byPrefix[prefix]) byPrefix[prefix] = [];
    byPrefix[prefix].push(p);
  }

  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY BY PREFIX");
  console.log("=".repeat(80));

  for (const [prefix, photos] of Object.entries(byPrefix).sort()) {
    console.log(`\n── ${prefix} (${photos.length} photos) ──`);

    // Group by date + tz_offset
    const byDateTz = {};
    for (const p of photos) {
      const key = `${p.date || "no-date"} | ${p.tz_offset || "no-tz"}`;
      if (!byDateTz[key]) byDateTz[key] = [];
      byDateTz[key].push(p);
    }

    for (const [key, group] of Object.entries(byDateTz).sort()) {
      const ids = group.map((p) => p.nasa_id).sort();
      const cameras = [
        ...new Set(group.map((p) => p.exif?.Model).filter(Boolean)),
      ];
      const serials = [
        ...new Set(group.map((p) => p.exif?.SerialNumber).filter(Boolean)),
      ];
      const creators = [
        ...new Set(group.map((p) => p.exif?.Creator).filter(Boolean)),
      ];

      console.log(`  ${key}: ${group.length} photos`);
      console.log(`    IDs: ${ids[0]} ... ${ids[ids.length - 1]}`);
      if (cameras.length)
        console.log(`    Cameras: ${cameras.join(", ")}`);
      if (serials.length)
        console.log(`    Serials: ${serials.join(", ")}`);
      if (creators.length)
        console.log(`    Creators: ${creators.join(", ")}`);
    }
  }

  // Special focus: recovery day mixed timezones
  const recoveryPhotos = output.filter(
    (p) =>
      p.nasa_id.startsWith("jsc2026e") &&
      (p.date === "2026-04-10" || p.date === "2026-04-11")
  );
  if (recoveryPhotos.length) {
    console.log("\n" + "=".repeat(80));
    console.log("RECOVERY DAY DETAIL (jsc2026e, Apr 10-11)");
    console.log("=".repeat(80));

    const byTz = {};
    for (const p of recoveryPhotos) {
      const tz = p.tz_offset || "no-tz";
      if (!byTz[tz]) byTz[tz] = [];
      byTz[tz].push(p);
    }

    for (const [tz, group] of Object.entries(byTz).sort()) {
      const ids = group.map((p) => p.nasa_id).sort();
      const cameras = [
        ...new Set(group.map((p) => p.exif?.Model).filter(Boolean)),
      ];
      const serials = [
        ...new Set(group.map((p) => p.exif?.SerialNumber).filter(Boolean)),
      ];
      const creators = [
        ...new Set(group.map((p) => p.exif?.Creator).filter(Boolean)),
      ];

      console.log(`\n  TZ ${tz}: ${group.length} photos`);
      console.log(`    First ID: ${ids[0]}`);
      console.log(`    Last ID:  ${ids[ids.length - 1]}`);
      if (cameras.length)
        console.log(`    Cameras: ${cameras.join(", ")}`);
      if (serials.length)
        console.log(`    Serials: ${serials.join(", ")}`);
      if (creators.length)
        console.log(`    Creators: ${creators.join(", ")}`);

      // Show contiguous ID ranges
      const numericIds = ids
        .map((id) => {
          const m = id.match(/jsc2026e(\d+)/);
          return m ? parseInt(m[1]) : null;
        })
        .filter((n) => n !== null)
        .sort((a, b) => a - b);

      if (numericIds.length) {
        const ranges = [];
        let rangeStart = numericIds[0];
        let prev = numericIds[0];
        for (let i = 1; i < numericIds.length; i++) {
          if (numericIds[i] !== prev + 1) {
            ranges.push(
              rangeStart === prev
                ? `${rangeStart}`
                : `${rangeStart}-${prev}`
            );
            rangeStart = numericIds[i];
          }
          prev = numericIds[i];
        }
        ranges.push(
          rangeStart === prev
            ? `${rangeStart}`
            : `${rangeStart}-${prev}`
        );
        console.log(`    ID ranges: ${ranges.join(", ")}`);
      }
    }
  }
}

main().catch(console.error);
