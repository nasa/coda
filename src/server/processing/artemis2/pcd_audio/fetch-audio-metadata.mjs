/**
 * Fetches Artemis 2 PCD audio metadata from Imagery Online (IO) and enriches
 * each recording with a computed start time derived from the audio file itself.
 *
 * Background
 * ──────────
 * The PCD laptops (PLT, MS2, PCD3, …) run a Voice Recorder app that saves M4A
 * files. The M4A container's `creation_time` tag is set when the file is SAVED
 * (i.e. the END of the recording). To recover the actual start time we subtract
 * the file duration: startTime = creation_time − duration.
 *
 * IO Integration
 * ──────────────
 * These recordings appear in IO as photo-type assets (Artemis logo thumbnail)
 * with an attached audio file served as MP3:
 *   https://io.jsc.nasa.gov{webpath}/audio/{nasa_id}.mp3
 * The IO API `has_audio_file` flag (1 = has audio) lets us filter without
 * scraping HTML.
 *
 * The `collectionPath` in IO encodes the PCD device name:
 *   "…|PLT Sound recordings"  → device = "PLT"
 *   "…|MS2 Sound recordings"  → device = "MS2"
 *   "…|PCD3 Missing Audio"    → device = "PCD3"
 *
 * Local file fallback
 * ───────────────────
 * If LOCAL_AUDIO_ROOT exists and contains the M4A for a given nasa_id, ffprobe
 * is run locally (fast, no download). If the file is not found locally, the
 * script downloads the IO MP3 to a temp file and probes that instead.
 *
 * Source collections (add new ones to AUDIO_COLLECTIONS as mission progresses):
 *   2409450  FD06 PLT Sound Recordings
 *   2409033  FD05 Sound Recordings
 *
 * Usage:
 *   node src/server/processing/artemis2/pcd_audio/fetch-audio-metadata.mjs
 *
 * Reads:  .env (repo root) — requires IO_KEY
 * Writes: src/server/processing/artemis2/pcd_audio/pcd-audio.json
 */

import { execSync } from "child_process";
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";

// IO uses an internal NASA CA not trusted by Node's default CA bundle.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../../../..");

// ── Config ────────────────────────────────────────────────────────────────────

const envContent = readFileSync(resolve(ROOT, ".env"), "utf-8");
const ioKeyMatch = envContent.match(/IO_KEY="([^"]+)"/);
if (!ioKeyMatch) {
  console.error("IO_KEY not found in .env");
  process.exit(1);
}
const IO_KEY = ioKeyMatch[1];
const IO_HOST = "https://io.jsc.nasa.gov";
const IO_API_URL = `${IO_HOST}/api/search/rpp=500`;

/**
 * Root directory containing local M4A files, organised as:
 *   <LOCAL_AUDIO_ROOT>/FD05/art002a000001.m4a
 *   <LOCAL_AUDIO_ROOT>/FD06/MS2/art002a000005.M4A
 *   <LOCAL_AUDIO_ROOT>/FD06/PLT/art002a000028.M4A
 *   <LOCAL_AUDIO_ROOT>/FD06/PDC3/art002a000051.M4A
 * Set to null (or a non-existent path) to always use the download fallback.
 */
const LOCAL_AUDIO_ROOT = "D:\\ArtemisInRealTime_assets\\vehicle\\1_PCD-Audio-Files";

const OUTPUT_PATH = resolve(__dirname, "pcd-audio.json");

/**
 * IO collections to query. Add entries here as new audio collections appear.
 * Each entry: cid (collection ID), label, description.
 */
const AUDIO_COLLECTIONS = [
  {
    cid: 2409450,
    label: "FD06 PLT Sound Recordings",
    description: "Flight Day 06 – Lunar Flyby Audio – PLT (Pilot) sound recordings",
  },
  {
    cid: 2409033,
    label: "FD05 Sound Recordings",
    description: "Flight Day 05 – Sound Recordings (browse collection)",
    // IO still uses the old FD04 name internally — rewrite it in fetched metadata.
    rewrite: { from: "FD04", to: "FD05" },
  },
];

// ── IO API ────────────────────────────────────────────────────────────────────

async function fetchIO(params) {
  const url = `${IO_API_URL}&${params}?key=${IO_KEY}&format=json`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", Origin: "https://coda.fit.nasa.gov" },
  });
  if (!res.ok) throw new Error(`IO API error: ${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

async function fetchAllDocsForCollection(cid) {
  const baseParams = `cols=${cid}&as=1&so=7`;
  const first = await fetchIO(baseParams);
  const numfound = first.results?.response?.numfound ?? 0;
  const docs = [...(first.results?.response?.docs ?? [])];
  const pages = Math.ceil(numfound / 500);
  for (let i = 1; i < pages; i++) {
    const sr = i * 500 + 1;
    const res = await fetchIO(`${baseParams}&sr=${sr}`);
    docs.push(...(res.results?.response?.docs ?? []));
    console.log(`  Page ${i + 1}/${pages} — ${docs.length} fetched`);
  }
  return { numfound, docs };
}

function parseIODoc(doc, collectionInfo) {
  const audioUrl = `${IO_HOST}${doc.webpath}/audio/${doc.nasa_id}.mp3`;
  const infoUrl = `${IO_HOST}/app/info.cfm?pid=${doc.id}`;
  // Last pipe-delimited segment encodes the device name
  let collectionPath =
    doc.collections_string?.[doc.collections_string.length - 1]?.replace(/^P\d+\//, "") ?? "";
  let title = doc.description || doc.nasa_id;

  // Apply collection-level string rewrites (e.g. IO uses stale FD04 label)
  if (collectionInfo.rewrite) {
    const { from, to } = collectionInfo.rewrite;
    title = title.replaceAll(from, to);
    collectionPath = collectionPath.replaceAll(from, to);
  }

  return {
    nasa_id: doc.nasa_id,
    title,
    collectionPath,
    audioUrl,
    infoUrl,
  };
}

// ── Device name ───────────────────────────────────────────────────────────────

/**
 * Maps the raw IO device token to a canonical PCD device label.
 * IO uses crew-position names (PLT, MS2) that don't match the physical
 * laptop numbering — we normalise them here.
 *   PLT  → PCD1  (Pilot laptop)
 *   MS2  → PCD2  (Mission Specialist 2 laptop)
 *   PCD3 → PCD3  (unchanged)
 *   null / anything else → PCD3  (FD05 browse collection has no device segment)
 */
const DEVICE_MAP = {
  PLT: "PCD1",
  MS2: "PCD2",
  PCD3: "PCD3",
};

/**
 * Extract a short PCD device name from the IO collection path.
 * Looks for a leading short uppercase+digit token in any path segment,
 * most-specific first (e.g. "PLT Sound recordings" → "PLT").
 */
function extractDevice(collectionPath) {
  if (!collectionPath) return null;
  const EXCLUDE = new Set(["MISSION", "IMAGERY", "LUNAR", "FLYBY", "AUDIO"]);
  for (const seg of collectionPath.split("|").reverse()) {
    const m = seg.trim().match(/^([A-Z][A-Z0-9]{1,5})\b/);
    if (m && !EXCLUDE.has(m[1])) return m[1];
  }
  return null;
}

/** Translate raw IO device token to canonical display label. */
function canonicalDevice(rawDevice) {
  return DEVICE_MAP[rawDevice] ?? "PCD3";
}

// ── Local file index ──────────────────────────────────────────────────────────

/**
 * Recursively walk LOCAL_AUDIO_ROOT and build a Map of
 * lowercase nasa_id → absolute file path for all .m4a files.
 */
function buildLocalFileIndex(rootDir) {
  const map = new Map();
  if (!rootDir || !existsSync(rootDir)) return map;

  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = resolve(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (/\.m4a$/i.test(entry)) {
        map.set(entry.replace(/\.m4a$/i, "").toLowerCase(), full);
      }
    }
  }
  walk(rootDir);
  return map;
}

// ── ffprobe ───────────────────────────────────────────────────────────────────

/**
 * Run ffprobe on a file path, returning { creationTime, durationSeconds }.
 * creationTime is the M4A save timestamp (= end of recording).
 */
function probeFile(filePath) {
  const raw = execSync(`ffprobe -v quiet -print_format json -show_format "${filePath}"`, {
    encoding: "utf-8",
  });
  const data = JSON.parse(raw);
  const tags = data.format?.tags ?? {};
  return {
    creationTime: tags.creation_time ?? null,
    durationSeconds: parseFloat(data.format?.duration ?? "0"),
  };
}

/**
 * Compute ISO start time: creation_time (= end) minus duration.
 */
function computeStartTime(creationTime, durationSeconds) {
  if (!creationTime || !durationSeconds) return null;
  const endMs = new Date(creationTime).getTime();
  if (isNaN(endMs)) return null;
  return new Date(endMs - Math.round(durationSeconds * 1000)).toISOString();
}

// ── Download fallback ─────────────────────────────────────────────────────────

/**
 * Download the IO MP3 for a recording to a temp file, probe it, then delete it.
 * Returns { creationTime, durationSeconds } or throws on failure.
 *
 * Note: the MP3 served by IO is transcoded from the original M4A, so the
 * `creation_time` tag may not be preserved. If the tag is missing, both
 * values will be null and startTime will remain null for this recording.
 */
async function downloadAndProbe(audioUrl, nasaId) {
  const tmpDir = tmpdir();
  const tmpFile = resolve(tmpDir, `pcd-audio-probe-${nasaId}.mp3`);
  console.log(`    ↓ Downloading ${audioUrl} …`);

  const res = await fetch(audioUrl, {
    headers: { Origin: "https://coda.fit.nasa.gov" },
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);

  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(tmpFile, buf);

  try {
    return probeFile(tmpFile);
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {
      /* ignore */
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // ── Step 1: fetch IO metadata ──────────────────────────────────────────────
  const allRecords = [];
  const stats = { total: 0, withAudio: 0, skippedNoAudio: 0, restricted: 0 };

  for (const collectionInfo of AUDIO_COLLECTIONS) {
    console.log(`\nFetching collection ${collectionInfo.cid} — ${collectionInfo.label}…`);
    const { numfound, docs } = await fetchAllDocsForCollection(collectionInfo.cid);
    console.log(`  Found ${numfound} items`);

    let skipped = 0;
    for (const doc of docs) {
      stats.total++;
      if (!doc.has_audio_file || doc.has_audio_file === 0 || doc.has_audio_file === "0") {
        stats.skippedNoAudio++;
        skipped++;
        continue;
      }
      const record = parseIODoc(doc, collectionInfo);
      if (doc.audio_file_restricted === 1 || doc.audio_file_restricted === "1") stats.restricted++;
      stats.withAudio++;
      allRecords.push(record);
    }
    if (skipped > 0) console.log(`  Skipped ${skipped} items without audio (co-located photos)`);
  }

  // Sort by nasa_id for stable ordering (no datetimeTaken in slim schema; will be
  // replaced by startTime below)
  allRecords.sort((a, b) => a.nasa_id.localeCompare(b.nasa_id));

  // Deduplicate by nasa_id (a recording may appear in multiple sub-collections)
  const seen = new Set();
  const deduped = allRecords.filter((r) => {
    if (seen.has(r.nasa_id)) return false;
    seen.add(r.nasa_id);
    return true;
  });
  const dupCount = allRecords.length - deduped.length;

  // ── Step 2: enrich with timing ────────────────────────────────────────────
  console.log(`\nBuilding local file index from ${LOCAL_AUDIO_ROOT}…`);
  const localFiles = buildLocalFileIndex(LOCAL_AUDIO_ROOT);
  const localCount = localFiles.size;
  console.log(
    localCount > 0
      ? `  Found ${localCount} local M4A file(s)`
      : `  No local files found — will download each file to probe timing`
  );

  const enriched = [];
  let probeLocal = 0,
    probeDownload = 0,
    probeFailed = 0;

  for (const rec of deduped) {
    const device = canonicalDevice(extractDevice(rec.collectionPath));
    let startTime = null,
      durationSeconds = null,
      endTime = null,
      source = null;

    const localPath = localFiles.get(rec.nasa_id.toLowerCase());

    if (localPath) {
      // ── Local probe ──
      try {
        const p = probeFile(localPath);
        endTime = p.creationTime;
        durationSeconds = p.durationSeconds;
        startTime = computeStartTime(endTime, durationSeconds);
        source = "local";
        probeLocal++;
        console.log(
          `  ✓ local   ${rec.nasa_id}  start=${startTime}  dur=${durationSeconds?.toFixed(1)}s`
        );
      } catch (err) {
        console.warn(`  ⚠ ffprobe failed (local) for ${rec.nasa_id}: ${err.message}`);
        probeFailed++;
      }
    } else {
      // ── Download fallback ──
      try {
        const p = await downloadAndProbe(rec.audioUrl, rec.nasa_id);
        endTime = p.creationTime;
        durationSeconds = p.durationSeconds;
        startTime = computeStartTime(endTime, durationSeconds);
        source = "download";
        probeDownload++;
        console.log(
          `  ✓ dl      ${rec.nasa_id}  start=${startTime}  dur=${durationSeconds?.toFixed(1)}s`
        );
      } catch (err) {
        console.warn(`  ⚠ probe failed (download) for ${rec.nasa_id}: ${err.message}`);
        probeFailed++;
      }
    }

    enriched.push({
      nasa_id: rec.nasa_id,
      title: rec.title,
      device,
      collectionPath: rec.collectionPath,
      // startTime: computed from endTime − duration
      // (M4A creation_time = save timestamp = end of recording)
      startTime,
      durationSeconds,
      endTime,
      audioUrl: rec.audioUrl,
      // infoUrl: links to the Imagery Online detail page for this recording
      infoUrl: rec.infoUrl,
    });
  }

  // Re-sort by startTime now that we have it
  enriched.sort((a, b) => {
    if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
    if (a.startTime) return -1;
    if (b.startTime) return 1;
    return a.nasa_id.localeCompare(b.nasa_id);
  });

  // ── Write output ──────────────────────────────────────────────────────────
  const output = {
    generatedAt: new Date().toISOString(),
    sourceCollections: AUDIO_COLLECTIONS.map((c) => ({
      cid: c.cid,
      label: c.label,
      description: c.description,
      url: `${IO_HOST}/app/collections.cfm?cid=${c.cid}`,
    })),
    stats: {
      ...stats,
      deduplicated: dupCount,
      output: enriched.length,
      probeLocal,
      probeDownload,
      probeFailed,
    },
    // startTime is computed as endTime (M4A creation_time = save timestamp) minus durationSeconds.
    timingNote:
      "startTime = M4A creation_time − duration. creation_time is the save timestamp (= end of recording).",
    recordings: enriched,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

  console.log("\n── Summary ─────────────────────────────────────────────────");
  console.log(`  Total IO items fetched:  ${stats.total}`);
  console.log(`  With audio:              ${stats.withAudio}`);
  console.log(`  Skipped (no audio):      ${stats.skippedNoAudio}`);
  console.log(`  Duplicates removed:      ${dupCount}`);
  console.log(`  Probed locally:          ${probeLocal}`);
  console.log(`  Probed via download:     ${probeDownload}`);
  console.log(`  Probe failures:          ${probeFailed}`);
  console.log(`\nWrote ${OUTPUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
