/**
 * Generates photo-time-overrides.json from scraped EXIF metadata.
 *
 * Reads photo-exif-metadata.json (produced by scrape-io-photo-metadata.mjs),
 * determines each photo's actual timezone offset, and outputs a correction
 * for EVERY photo where the timezone is known.
 *
 * This is the sole timezone correction mechanism — there is no database
 * fallback. Photos not in the JSON are left uncorrected.
 *
 * Timezone determination per photo (in priority order):
 *   1. Scraped tz_offset from EXIF DigitalCreationTime / TimeCreated
 *   2. Camera serial number → timezone mapping (for photos without EXIF tz)
 *   3. Default timezone for the nasa_id prefix (jsc2026e → CDT, nhq → EDT)
 *
 * Output: photo-time-overrides.json — flat { nasa_id: timeOffset } mapping
 *
 * Usage: node src/server/processing/artemis2/photos/generate-photo-time-overrides.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Camera serial → timezone mapping ───────────────────────────────────────
// Determined by cross-referencing EXIF DigitalCreationTime offsets with
// IO collection strings (see README.md for full analysis).
//
// ONLY include cameras that have a CONSISTENT non-default timezone across
// the entire mission. Cameras that changed timezone (e.g., Blair's 3022521
// was -05:00 in Houston then -07:00 in San Diego) are excluded — they're
// handled by scraped EXIF tz_offset on the days where it's available.
const CAMERA_TZ = {
  // Houston photographers with cameras set to CST (missed DST switch).
  // These cameras show -06:00 consistently across every day they appear.
  3023828: "-06:00", // David DeHoyos — NIKON Z 9
  3035041: "-06:00", // Luna Posadas Nava — NIKON Z 9
};

// Default timezone for each nasa_id prefix. Applied to photos where we have
// no EXIF tz_offset and no camera serial mapping.
const PREFIX_DEFAULTS = {
  jsc2026e: "-05:00", // JSC photographers, CDT
  nhq: "-04:00", // NHQ photographers at KSC, EDT
};

function getDefaultTz(nasaId) {
  for (const [prefix, tz] of Object.entries(PREFIX_DEFAULTS)) {
    if (nasaId.startsWith(prefix)) return tz;
  }
  return null;
}

/**
 * Extract camera body serial number from EXIF data.
 * Handles two formats:
 *   - Processed JPGs: fields named "SerialNumber" or "Serial Number"
 *   - Raw NEFs (Nikon): "MODEL" field contains "NIKON D6 S/N: 3001958"
 */
function getSerial(exif) {
  if (!exif) return null;
  const serial = exif["SerialNumber"] || exif["Serial Number"];
  if (serial) return serial;
  if (exif["MODEL"]) {
    const m = exif["MODEL"].match(/S\/N:\s*(\d+)/);
    if (m) return m[1];
  }
  return null;
}

function main() {
  const inputPath = resolve(__dirname, "photo-exif-metadata.json");
  const data = JSON.parse(readFileSync(inputPath, "utf-8"));
  console.log(`Read ${data.length} photos from ${inputPath}`);

  const overrides = {};
  let fromExif = 0;
  let fromSerial = 0;
  let fromDefault = 0;
  let skipped = 0;

  for (const photo of data) {
    const defaultTz = getDefaultTz(photo.nasa_id);
    if (!defaultTz) {
      skipped++;
      continue; // Unknown prefix (e.g., art002e onboard) — no correction needed
    }

    // 1. Use scraped tz_offset if available
    let actualTz = photo.tz_offset;
    let source = "exif";

    // 2. Fall back to camera serial mapping
    if (!actualTz) {
      const serial = getSerial(photo.exif);
      if (serial && CAMERA_TZ[serial]) {
        actualTz = CAMERA_TZ[serial];
        source = "serial";
      }
    }

    // 3. Fall back to prefix default
    if (!actualTz) {
      actualTz = defaultTz;
      source = "default";
    }

    // Convert tz offset to timeOffset format: "-05:00" → "-05:00:00"
    const timeOffset = actualTz + ":00";
    overrides[photo.nasa_id] = timeOffset;

    if (source === "exif") fromExif++;
    else if (source === "serial") fromSerial++;
    else fromDefault++;
  }

  // Sort by nasa_id for stable output
  const sorted = Object.keys(overrides)
    .sort()
    .reduce((obj, key) => {
      obj[key] = overrides[key];
      return obj;
    }, {});

  const outputPath = resolve(__dirname, "photo-time-overrides.json");
  writeFileSync(outputPath, JSON.stringify(sorted, null, 2));

  console.log(`\nWrote ${Object.keys(sorted).length} overrides to ${outputPath}`);
  console.log(`  From EXIF tz_offset: ${fromExif}`);
  console.log(`  From camera serial:  ${fromSerial}`);
  console.log(`  From prefix default: ${fromDefault}`);
  console.log(`  Skipped (no prefix): ${skipped}`);

  // Summary by timezone
  const byTz = {};
  for (const [id, tz] of Object.entries(sorted)) {
    byTz[tz] = (byTz[tz] || 0) + 1;
  }
  console.log("\nOverrides by timezone:");
  for (const [tz, count] of Object.entries(byTz).sort()) {
    console.log(`  ${tz}: ${count} photos`);
  }
}

main();
