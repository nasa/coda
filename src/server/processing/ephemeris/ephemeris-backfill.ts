/**
 * ISS TLE Database Backfill from Space-Track (`gp_history` class).
 *
 * Replaces the legacy seed-from-issinrealtime.org flow. Designed to make the
 * absolute minimum number of Space-Track API calls — typically ONE per run —
 * because the `gp_history` class is rate-limited "1 / lifetime" and abusing it
 * can get the account suspended.
 *
 * Strategy:
 *   1. Pull all existing epochs from the DB (timestamps only — cheap).
 *   2. Walk consecutive pairs looking for gaps > GAP_THRESHOLD_HOURS, skipping
 *      any that match the KNOWN_GOOD_GAP_STARTS_MS allowlist (periods where
 *      Space-Track genuinely had no ISS TLEs).
 *   3. If no unexpected gaps, do nothing (zero API calls).
 *   4. Otherwise issue ONE `gp_history` query covering [earliest_gap_start, now]
 *      with EPOCH range filtering. The existing upsert dedup logic skips the
 *      records we already have.
 *
 *   The "trailing gap" (latest epoch → now) is NOT checked here — keeping the
 *   tail current is the scheduler's job (runs every 6h).
 *
 * IMPORTANT: This module should only be invoked by the prod instance. Other CODA
 * instances sync from prod via ephemeris-remoteSync.ts (EPHEMERIS_SYNC_FROM_URL) and
 * must not hit Space-Track directly. The route handler enforces this guard.
 */
import fetchWithTimeout from "utils/fetch-with-timeout";
import ConsoleLogger from "utils/logging/consoleLogger";
import { upsertEphemerisRecords } from "./ephemeris";
import {
  calculateEpochFromTLE,
  loginToSpaceTrack,
  ISS_NORAD_ID,
  SPACETRACK_API_BASE_URL,
} from "./ephemeris-spacetrack";
import { getORM } from "server/express/global";

/**
 * Maximum acceptable gap (in hours) between consecutive TLE epochs before we
 * consider the data "missing" and worth backfilling. Modern Space-Track
 * publishes 3-5 ISS TLEs per day, so anything > 48h is worth investigating.
 * Known-good historical gaps are allow-listed below so they don't trigger a
 * false-positive backfill.
 */
const GAP_THRESHOLD_HOURS = 48;
const GAP_THRESHOLD_MS = GAP_THRESHOLD_HOURS * 60 * 60 * 1000;

/**
 * Known-good gaps in the Space-Track ISS TLE record that are NOT missing
 * data — Space-Track simply didn't publish TLEs during these periods.
 * Derived from the complete backfill run of 2026-05-14.
 *
 * It is okay to hard code these because historical ISS data is never changing.
 *
 * Each entry is [gapStartEpochMs, gapEndEpochMs]. A detected gap whose start
 * falls within ±1h of a known gap start is considered legitimate and ignored.
 *
 * ┌──────────────────────┬──────────────────────┬───────────┐
 * │ Gap start            │ Gap end              │ Hours     │
 * ├──────────────────────┼──────────────────────┼───────────┤
 * │ 2000-11-07 11:59     │ 2000-11-09 21:12     │  57.2     │
 * │ 2013-04-22 13:58     │ 2013-04-24 18:41     │  52.7     │
 * │ 2013-05-02 21:45     │ 2013-05-05 02:07     │  52.4     │
 * │ 2014-05-06 22:09     │ 2014-05-13 16:44     │ 162.6     │
 * │ 2015-02-13 07:03     │ 2015-02-18 13:07     │ 126.1     │
 * │ 2015-09-09 12:31     │ 2015-09-11 13:59     │  49.5     │
 * │ 2017-01-24 12:57     │ 2017-01-26 16:45     │  51.8     │
 * │ 2017-01-31 17:11     │ 2017-02-02 22:08     │  53.0     │
 * │ 2020-03-11 05:57     │ 2020-03-14 00:22     │  66.4     │
 * │ 2020-11-07 22:23     │ 2020-11-10 13:50     │  63.5     │
 * │ 2021-01-27 18:43     │ 2021-01-29 21:52     │  51.2     │
 * │ 2022-06-15 23:35     │ 2022-06-19 12:25     │  84.8     │
 * │ 2022-07-22 11:16     │ 2022-07-24 20:35     │  57.3     │
 * │ 2023-07-22 02:59     │ 2023-07-24 13:44     │  58.7     │
 * │ 2025-04-29 04:34     │ 2025-05-01 15:23     │  58.8     │
 * │ 2025-08-20 18:58     │ 2025-08-23 04:13     │  57.2     │
 * └──────────────────────┴──────────────────────┴───────────┘
 */
const KNOWN_GOOD_GAP_STARTS_MS: number[] = [
  Date.parse("2000-11-07T11:59:47.854Z"),
  Date.parse("2013-04-22T13:58:39.710Z"),
  Date.parse("2013-05-02T21:45:59.999Z"),
  Date.parse("2014-05-06T22:09:06.564Z"),
  Date.parse("2015-02-13T07:03:34.712Z"),
  Date.parse("2015-09-09T12:31:23.470Z"),
  Date.parse("2017-01-24T12:57:47.270Z"),
  Date.parse("2017-01-31T17:11:33.000Z"),
  Date.parse("2020-03-11T05:57:18.749Z"),
  Date.parse("2020-11-07T22:23:09.000Z"),
  Date.parse("2021-01-27T18:43:05.456Z"),
  Date.parse("2022-06-15T23:35:23.889Z"),
  Date.parse("2022-07-22T11:16:14.257Z"),
  Date.parse("2023-07-22T02:59:40.050Z"),
  Date.parse("2025-04-29T04:34:06.494Z"),
  Date.parse("2025-08-20T18:58:47.517Z"),
];

/** Tolerance for matching a gap start against the known-good list (±1 hour). */
const KNOWN_GAP_TOLERANCE_MS = 60 * 60 * 1000;

function isKnownGoodGap(gapStartMs: number): boolean {
  return KNOWN_GOOD_GAP_STARTS_MS.some(
    (known) => Math.abs(gapStartMs - known) <= KNOWN_GAP_TOLERANCE_MS
  );
}

/**
 * Generous timeout — gp_history can return tens of thousands of rows for a
 * multi-year span and Space-Track may take a while to assemble the response.
 */
const GP_HISTORY_TIMEOUT_MS = 5 * 60 * 1000;

/** Lightweight gap-scan result — no Space-Track calls, just DB analysis. */
export interface GapScanResult {
  totalRecords: number;
  gapsDetected: number;
  knownGapsSkipped: number;
  /** ISO timestamp of the earliest unexpected gap start, or null if clean. */
  earliestGapStart: string | null;
  gapThresholdHours: number;
}

/**
 * Scan the local DB for gaps without calling Space-Track.
 * Returns a lightweight summary the admin UI can use to show whether
 * a backfill is needed.
 */
export async function scanForGaps(): Promise<GapScanResult> {
  const epochsAsc = await getAllEpochsAsc();
  if (epochsAsc.length === 0) {
    return {
      totalRecords: 0,
      gapsDetected: 0,
      knownGapsSkipped: 0,
      earliestGapStart: null,
      gapThresholdHours: GAP_THRESHOLD_HOURS,
    };
  }
  const { earliestGapStart, gapsDetected, knownGapsSkipped } = detectGaps(epochsAsc);
  return {
    totalRecords: epochsAsc.length,
    gapsDetected,
    knownGapsSkipped,
    earliestGapStart: earliestGapStart?.toISOString() ?? null,
    gapThresholdHours: GAP_THRESHOLD_HOURS,
  };
}

export interface BackfillResult {
  success: boolean;
  errorMessage?: string;
  /** Earliest gap start that was queried, or null if no API call was made. */
  rangeStart?: string | null;
  rangeEnd?: string | null;
  /** Number of TLEs returned by Space-Track in the gp_history response. */
  recordsFetched?: number;
  recordsInserted?: number;
  recordsSkipped?: number;
  /** Number of distinct gaps detected in the DB (informational). */
  gapsDetected?: number;
}

/** Format a Date as Space-Track's expected `YYYY-MM-DD HH:MM:SS` (UTC). */
function formatSpacetrackDate(d: Date): string {
  const iso = d.toISOString(); // 2026-01-15T03:04:05.123Z
  return iso.slice(0, 10) + " " + iso.slice(11, 19);
}

interface DetectedGaps {
  earliestGapStart: Date | null;
  gapsDetected: number;
}

/**
 * Walk the sorted epoch list and find gaps larger than GAP_THRESHOLD_MS,
 * excluding gaps that match the known-good allowlist (periods where
 * Space-Track genuinely had no TLEs).
 *
 * Returns the earliest *real* gap start (i.e. one not in the allowlist)
 * plus counts of gaps found and gaps skipped.
 *
 * NOTE: This intentionally does NOT check for a "trailing gap" between the
 * latest epoch and now. Keeping the tail current is the scheduler's job
 * (runs every 6h via `updateFromSpaceTrack`). The backfill only cares about
 * holes *between* existing records.
 */
function detectGaps(epochsAsc: number[]): DetectedGaps & { knownGapsSkipped: number } {
  if (epochsAsc.length === 0) {
    // Empty DB — caller should query from ISS launch.
    return { earliestGapStart: null, gapsDetected: 1, knownGapsSkipped: 0 };
  }

  let earliestGapStartMs: number | null = null;
  let gapsDetected = 0;
  let knownGapsSkipped = 0;

  for (let i = 1; i < epochsAsc.length; i++) {
    const delta = epochsAsc[i] - epochsAsc[i - 1];
    if (delta > GAP_THRESHOLD_MS) {
      if (isKnownGoodGap(epochsAsc[i - 1])) {
        knownGapsSkipped++;
        continue;
      }
      gapsDetected++;
      if (earliestGapStartMs === null) {
        earliestGapStartMs = epochsAsc[i - 1];
      }
    }
  }

  return {
    earliestGapStart: earliestGapStartMs === null ? null : new Date(earliestGapStartMs),
    gapsDetected,
    knownGapsSkipped,
  };
}

/**
 * Issue a single `gp_history` query for the given EPOCH range.
 * Uses the existing Space-Track session from loginToSpaceTrack().
 *
 * Per Space-Track API docs: `gp_history` is rate-limited "1 / lifetime" — call
 * sparingly and store the result locally.
 */
async function fetchGpHistoryRange(
  loginCookies: string[],
  start: Date,
  end: Date
): Promise<SpaceTrackGpRecord[] | null> {
  const startStr = encodeURIComponent(formatSpacetrackDate(start));
  const endStr = encodeURIComponent(formatSpacetrackDate(end));
  const orderBy = "orderby/EPOCH%20asc";
  const predicates = "predicates/TLE_LINE1,TLE_LINE2";
  const query =
    `/class/gp_history/NORAD_CAT_ID/${ISS_NORAD_ID}` +
    `/EPOCH/${startStr}--${endStr}/${orderBy}/format/json/${predicates}`;
  const url = `${SPACETRACK_API_BASE_URL}${query}`;

  ConsoleLogger.info(
    `Backfill: fetching gp_history for ISS, EPOCH ${formatSpacetrackDate(start)} -- ${formatSpacetrackDate(end)}`
  );
  ConsoleLogger.debug(`Backfill request URL: ${url}`);

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent": "CODA_TLE_Backfill/1.0",
          Cookie: loginCookies.join("; "),
        },
      },
      GP_HISTORY_TIMEOUT_MS
    );

    if (!response.ok) {
      const errorText = await response.text();
      ConsoleLogger.error(
        `Space-Track gp_history error: ${response.status} ${response.statusText}. Body: ${errorText.substring(0, 500)}`
      );
      return null;
    }

    const data: SpaceTrackGpRecord[] = await response.json();
    ConsoleLogger.info(`Backfill: gp_history returned ${data.length} records`);
    return data;
  } catch (e) {
    ConsoleLogger.error(`Space-Track gp_history fetch error: ${e}`);
    return null;
  }
}

/**
 * Detect any gaps in the local TLE DB and, if needed, issue a single
 * `gp_history` query to Space-Track to backfill them.
 *
 * @param onProgress optional callback for streaming progress to the caller
 *   (e.g. an admin UI listening to the ndjson route response).
 */
export async function backfillFromSpaceTrack(
  onProgress?: (message: string) => void
): Promise<BackfillResult> {
  const progress = (msg: string) => {
    ConsoleLogger.info(`Backfill: ${msg}`);
    onProgress?.(msg);
  };

  try {
    progress("Scanning local DB for gaps...");
    const epochsAsc = await getAllEpochsAsc();
    progress(`Found ${epochsAsc.length} existing TLE records in DB`);

    const { earliestGapStart, gapsDetected, knownGapsSkipped } = detectGaps(epochsAsc);

    if (knownGapsSkipped > 0) {
      progress(`Ignored ${knownGapsSkipped} known-good gap(s) where Space-Track had no data`);
    }

    let queryStart: Date;
    if (epochsAsc.length === 0) {
      progress("DB is empty — will backfill full ISS history from Space-Track");
      queryStart = new Date("1998-11-20T00:00:00Z");
    } else if (earliestGapStart === null) {
      progress(
        `No gaps > ${GAP_THRESHOLD_HOURS}h detected (${knownGapsSkipped} known gaps ignored). ` +
          `Nothing to backfill — skipping Space-Track call.`
      );
      return {
        success: true,
        rangeStart: null,
        rangeEnd: null,
        recordsFetched: 0,
        recordsInserted: 0,
        recordsSkipped: 0,
        gapsDetected: 0,
      };
    } else {
      progress(
        `Detected ${gapsDetected} unexpected gap(s); earliest gap starts at ${earliestGapStart.toISOString()}`
      );
      queryStart = earliestGapStart;
    }

    const queryEnd = new Date();

    progress(
      `Issuing ONE gp_history query: ${queryStart.toISOString()} -> ${queryEnd.toISOString()}`
    );

    const loginCookies = await loginToSpaceTrack();
    if (!loginCookies) {
      const msg = "Failed to authenticate with Space-Track";
      progress(msg);
      return { success: false, errorMessage: msg };
    }

    const tleRecords = await fetchGpHistoryRange(loginCookies, queryStart, queryEnd);
    if (!tleRecords) {
      const msg = "Failed to fetch gp_history from Space-Track";
      progress(msg);
      return { success: false, errorMessage: msg };
    }

    progress(`Space-Track returned ${tleRecords.length} TLE records; processing...`);

    const processed: Array<{ epoch: string; tle_line1: string; tle_line2: string }> = [];
    let invalid = 0;

    for (const record of tleRecords) {
      const line1 = record.TLE_LINE1?.trim();
      const line2 = record.TLE_LINE2?.trim();
      if (!line1 || !line2) {
        invalid++;
        continue;
      }
      const epoch = calculateEpochFromTLE(line1, line2);
      if (!epoch) {
        invalid++;
        continue;
      }
      processed.push({
        epoch: epoch.toISOString(),
        tle_line1: line1,
        tle_line2: line2,
      });
    }

    if (invalid > 0) {
      progress(`Skipped ${invalid} records with missing/invalid TLE data`);
    }

    const upsertResult = await upsertEphemerisRecords({
      records: processed,
      origin: "spacetrack",
    });

    progress(
      `Backfill complete: inserted ${upsertResult.inserted} new, skipped ${upsertResult.skipped} duplicates`
    );

    return {
      success: true,
      rangeStart: queryStart.toISOString(),
      rangeEnd: queryEnd.toISOString(),
      recordsFetched: tleRecords.length,
      recordsInserted: upsertResult.inserted,
      recordsSkipped: upsertResult.skipped,
      gapsDetected,
    };
  } catch (e) {
    const msg = `Backfill error: ${e instanceof Error ? e.message : String(e)}`;
    ConsoleLogger.error(msg);
    if (e instanceof Error && e.stack) {
      ConsoleLogger.error(e.stack);
    }
    return { success: false, errorMessage: msg };
  }
}

/**
 * Get all epochs in the DB ordered ascending. Used by the backfill to
 * detect gaps in coverage so it can issue a single targeted Space-Track query.
 * Returns just the timestamps (ms since epoch) — no TLE strings — to keep
 * memory low even when the DB has tens of thousands of records.
 */
export async function getAllEpochsAsc(): Promise<number[]> {
  const em = getORM().em.fork();
  const connection = em.getConnection();
  const result = await connection.execute(`SELECT epoch FROM ephemeris_db ORDER BY epoch ASC`);
  const rows: Array<{ epoch: Date | string }> =
    (result as { rows?: Array<{ epoch: Date | string }> }).rows ??
    (result as Array<{ epoch: Date | string }>);
  return rows.map((r) => new Date(r.epoch).getTime());
}
