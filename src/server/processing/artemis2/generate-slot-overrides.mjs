/**
 * Generates slot-overrides.json from video-notes.json.
 *
 * Most Artemis 2 videos can be assigned to a downlink slot programmatically
 * (by collection_string channel or nasa_id source code — see io-api.ts
 * getArtemisChannel). This script handles the videos that CANNOT be resolved
 * that way, primarily:
 *
 *   - Recovery-phase source 150 feeds: all share source code 150 but represent
 *     completely different cameras (NASA broadcast, carrier quad, helicopters).
 *     The Mission Video Notes field is used to distinguish them.
 *   - Aircraft footage (sources 160, 200, 201): assigned to reuse downlink
 *     slots that are empty during those mission phases.
 *
 * Feed-type → slot mapping (consistent across all time segments):
 *
 *   Slot 3  → SCIFLI aircraft (source 160, reuses empty Ch03 during recovery)
 *   Slot 4  → WB-57 aircraft, recovery (source 201, reuses empty Ch04)
 *   Slot 5  → NASA broadcast / PAO / Continuous Coverage / News Conference
 *   Slot 6  → Quad Feed from Carrier
 *   Slot 7  → Helo feed 1 (recovery) / WB-57 aircraft, launch (source 200)
 *   Slot 8  → Helo feed 2
 *
 * Usage: node src/server/processing/artemis2/generate-slot-overrides.mjs
 *
 * Reads:  video-notes.json  (same directory)
 * Writes: slot-overrides.json (same directory)
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const videos = JSON.parse(readFileSync(resolve(__dirname, "video-notes.json"), "utf-8"));

// ---------------------------------------------------------------------------
// Recovery-phase boundary: after this timestamp, Downlink Ch03/Ch04 are no
// longer active, so those slots can be reused for aircraft feeds.
// ---------------------------------------------------------------------------
const RECOVERY_START = "2026-04-10T20:00:00Z";

// ---------------------------------------------------------------------------
// Feed-type classification rules for source 150 videos.
// Order matters: first match wins.
// ---------------------------------------------------------------------------
const SOURCE_150_RULES = [
  { pattern: /Quad Feed/i, slot: 6 },
  { pattern: /Helo feed.*1/i, slot: 7 },
  { pattern: /Helo feed.*2/i, slot: 8 },
  // Everything else under source 150 during recovery is NASA broadcast
  // (Continuous Coverage, PAO Event, NASA + SplashDown Coverage, News Conference)
  { pattern: /.*/, slot: 5 },
];

// ---------------------------------------------------------------------------
// Source-code rules for non-150 overrides (aircraft footage)
// ---------------------------------------------------------------------------
const SOURCE_CODE_OVERRIDES = {
  160: 3, // SCIFLI Gulfstream GV → reuse empty Ch03
  200: 7, // WB-57 aircraft (launch phase) → slot 7
  201: 4, // WB-57 aircraft (recovery phase) → reuse empty Ch04
};

// ---------------------------------------------------------------------------
// Generate the overrides
// ---------------------------------------------------------------------------
const overrides = {};
const stats = { bySlot: {}, byFeedType: {} };

for (const v of videos) {
  const { nasa_id, source_code, mission_video_notes: notes, start_gmt } = v;
  let slot = null;
  let feedType = null;

  // Aircraft footage: override by source code regardless of phase
  if (SOURCE_CODE_OVERRIDES[source_code] !== undefined) {
    slot = SOURCE_CODE_OVERRIDES[source_code];
    feedType = `source-${source_code}`;
  }

  // Source 150 during recovery: classify by notes
  if (source_code === "150" && start_gmt >= RECOVERY_START) {
    for (const rule of SOURCE_150_RULES) {
      if (rule.pattern.test(notes || "")) {
        slot = rule.slot;
        // Extract a readable feed type for the summary
        const typeMatch = (notes || "").match(
          /^(Quad Feed[^|]*|Helo feed[^|]*|PAO Event[^|]*|Continuous Coverage[^|]*|NASA \+ SplashDown[^|]*|Post.?Splashdown News Conference[^|]*|Artemis II Post Splashdown[^|]*)/i
        );
        feedType = typeMatch ? typeMatch[1].trim() : "NASA broadcast (other)";
        break;
      }
    }
  }

  if (slot !== null) {
    overrides[nasa_id] = slot;

    // Track stats
    stats.bySlot[slot] = (stats.bySlot[slot] || 0) + 1;
    stats.byFeedType[feedType] = stats.byFeedType[feedType] || { slot, count: 0, ids: [] };
    stats.byFeedType[feedType].count++;
    stats.byFeedType[feedType].ids.push(nasa_id);
  }
}

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------
const outputPath = resolve(__dirname, "slot-overrides.json");
writeFileSync(outputPath, JSON.stringify(overrides, null, 2));

// ---------------------------------------------------------------------------
// Print summary
// ---------------------------------------------------------------------------
console.log(`Wrote ${Object.keys(overrides).length} overrides to slot-overrides.json\n`);

console.log("Overrides by slot:");
for (const slot of Object.keys(stats.bySlot).sort()) {
  console.log(`  Slot ${slot}: ${stats.bySlot[slot]} videos`);
}

console.log("\nFeed type breakdown:");
for (const [type, info] of Object.entries(stats.byFeedType).sort((a, b) => a[1].slot - b[1].slot)) {
  console.log(`  Slot ${info.slot} | ${type} (${info.count})`);
  for (const id of info.ids) {
    console.log(`    ${id}`);
  }
}
