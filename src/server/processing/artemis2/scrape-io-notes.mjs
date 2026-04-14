/**
 * Scrapes "Mission Video Notes" from IO individual video pages for Artemis 2 videos.
 *
 * The IO search API does NOT return the "Mission Video Notes" field, but it's visible
 * on individual video info pages (info.cfm?pid=XXXXX). This script:
 *
 * 1. Fetches all Artemis 2 mission-day videos from the IO search API
 * 2. Scrapes the info page for each video to extract Mission Video Notes
 * 3. Writes results to src/server/processing/artemis2/video-notes.json
 *
 * Usage: node src/server/processing/artemis2/scrape-io-notes.mjs
 *
 * Requires IO_KEY in .env file.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../../..");

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
const ARTEMIS2_COLLECTION = 2399266;

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

async function fetchAllDocs() {
  const baseParams = `s_dt=${START_DATE}&e_dt=${END_DATE}&cols=${ARTEMIS2_COLLECTION}&as=2&so=7`;
  const first = await fetchIO(baseParams);
  const numfound = first.results?.response?.numfound ?? 0;
  console.log(`Total videos found: ${numfound}`);

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

async function scrapeNotesForDoc(doc) {
  const pid = doc.id;
  const url = `${IO_HOST}/app/info.cfm?pid=${pid}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "text/html" },
      signal: AbortSignal.timeout(15000),
    });
    const html = await res.text();

    // Extract Mission Video Notes field
    // Pattern: the field label "Mission Video Notes" followed by the value in a table cell
    let notes = "";

    // HTML structure:
    //   <th ...>Mission Video Notes</th>
    //   </tr>
    //   <td colspan="6"> VALUE </td>
    const patterns = [
      /Mission Video Notes<\/th>\s*<\/tr>\s*<td[^>]*>([\s\S]*?)<\/td>/i,
      /Mission Video Notes[^<]*<\/th>\s*<\/tr>\s*\n?\s*<td[^>]*>([\s\S]*?)<\/td>/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1].trim()) {
        notes = match[1].trim().replace(/<[^>]+>/g, "").trim();
        break;
      }
    }

    return { nasa_id: doc.nasa_id, pid, notes };
  } catch (e) {
    console.error(`  Error scraping ${pid} (${doc.nasa_id}): ${e.message}`);
    return { nasa_id: doc.nasa_id, pid, notes: "", error: e.message };
  }
}

async function processBatch(docs, startIdx) {
  const batch = docs.slice(startIdx, startIdx + CONCURRENCY);
  return Promise.all(batch.map((doc) => scrapeNotesForDoc(doc)));
}

async function main() {
  console.log("Fetching Artemis 2 video list from IO API...");
  const allDocs = await fetchAllDocs();
  console.log(`\nTotal docs: ${allDocs.length}`);

  // Build comprehensive metadata + scrape notes
  console.log("\nScraping Mission Video Notes from individual pages...");
  const results = [];
  let scraped = 0;

  for (let i = 0; i < allDocs.length; i += CONCURRENCY) {
    const batchResults = await processBatch(allDocs, i);
    results.push(...batchResults);
    scraped += batchResults.length;
    const pct = Math.round((scraped / allDocs.length) * 100);
    process.stdout.write(`\r  Progress: ${scraped}/${allDocs.length} (${pct}%)`);
  }
  console.log();

  // Build notes lookup
  const notesMap = {};
  for (const r of results) {
    notesMap[r.nasa_id] = r.notes;
  }

  // Build output: full video metadata with notes
  const output = allDocs.map((doc) => {
    const nid = doc.nasa_id;
    const srcMatch = nid.match(/^art\d{3}m(\d{3})/);
    const sourceCode = srcMatch ? srcMatch[1] : null;

    // Extract category and channel from collections_string
    let category = null;
    let channel = null;
    for (const cs of doc.collections_string) {
      const path = cs.includes("/") ? cs.split("/").slice(1).join("/") : cs;
      const parts = path.split("|");
      if (parts.length >= 5 && parts[4].includes("Channel")) {
        channel = parts[4].replace("Channel ", "").trim();
        category = parts[3];
      } else if (parts.length >= 4 && !category) {
        category = parts[3];
      }
    }

    const dateStr = doc.vmd_start_gmt || doc.md_creation_date;

    return {
      nasa_id: nid,
      pid: doc.id,
      source_code: sourceCode,
      category,
      channel,
      title: doc.md_title || null,
      description: doc.description || null,
      mission_video_notes: notesMap[nid] || null,
      start_gmt: dateStr,
      end_gmt: doc.vmd_end_gmt || null,
      duration_seconds: doc.duration_seconds || 0,
      collections_string: doc.collections_string,
    };
  });

  // Sort by start time
  output.sort((a, b) => new Date(a.start_gmt) - new Date(b.start_gmt));

  const outputPath = resolve(__dirname, "video-notes.json");
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${output.length} entries to ${outputPath}`);

  // Print summary stats
  const withNotes = output.filter((v) => v.mission_video_notes);
  const bySource = {};
  for (const v of output) {
    const src = v.source_code || "???";
    if (!bySource[src]) bySource[src] = { total: 0, withNotes: 0 };
    bySource[src].total++;
    if (v.mission_video_notes) bySource[src].withNotes++;
  }

  console.log("\nSummary by source code:");
  for (const [src, counts] of Object.entries(bySource).sort()) {
    console.log(`  Source ${src}: ${counts.total} total, ${counts.withNotes} with notes`);
  }
  console.log(`\nTotal with notes: ${withNotes.length}/${output.length}`);
}

main().catch(console.error);
