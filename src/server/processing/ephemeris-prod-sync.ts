/**
 * Pull new ISS TLE records from prod's /api/v1/db/ephemeris/recent endpoint.
 *
 * Used by non-prod CODA instances (int, dev, feature branches) instead of
 * polling Space-Track directly. Activated when EPHEMERIS_SYNC_FROM_URL is set;
 * the spacetrackScheduler dispatches to this function in place of
 * updateFromSpaceTrack on those instances.
 */
import fetchWithTimeout from "utils/fetch-with-timeout";
import ConsoleLogger from "utils/logging/consoleLogger";
import { getLatestEpoch, upsertEphemerisRecords } from "./ephemeris";

export async function syncEphemerisFromProd(): Promise<SpaceTrackUpdateResult> {
  const baseUrl = process.env.EPHEMERIS_SYNC_FROM_URL;
  const token = process.env.EMSS_TOKEN;

  if (!baseUrl) {
    return { success: false, errorMessage: "EPHEMERIS_SYNC_FROM_URL not set" };
  }
  if (!token) {
    return { success: false, errorMessage: "EMSS_TOKEN not set; cannot authenticate to prod" };
  }

  try {
    const latestEpoch = await getLatestEpoch();
    const sinceParam = latestEpoch ? `?since=${encodeURIComponent(latestEpoch.toISOString())}` : "";
    const url = `${baseUrl.replace(/\/$/, "")}/api/v1/db/ephemeris/recent${sinceParam}`;

    ConsoleLogger.info(
      `Syncing ephemeris from prod (since=${latestEpoch ? latestEpoch.toISOString() : "<empty DB, default 30d>"})`
    );

    // 30s timeout to accommodate larger first-time payloads on empty follower DBs.
    const response = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent": "CODA_Ephemeris_Follower/1.0",
          Authorization: `Bearer ${token}`,
        },
      },
      30000
    );

    if (!response.ok) {
      const errorText = await response.text();
      const msg = `Prod sync HTTP ${response.status} ${response.statusText}: ${errorText.substring(0, 300)}`;
      ConsoleLogger.error(msg);
      return { success: false, errorMessage: msg };
    }

    const records: EphemerisEntry[] = await response.json();

    if (!Array.isArray(records)) {
      const msg = "Prod sync response was not an array";
      ConsoleLogger.error(msg);
      return { success: false, errorMessage: msg };
    }

    if (records.length === 0) {
      ConsoleLogger.info("Prod sync: already up to date (0 new records)");
      return {
        success: true,
        epoch: latestEpoch?.toISOString() ?? null,
        recordsInserted: 0,
        recordsSkipped: 0,
      };
    }

    const result = await upsertEphemerisRecords({ records, origin: "spacetrack" });

    // The endpoint orders ascending, so the last record has the newest epoch.
    const newestEpoch = records[records.length - 1]?.epoch ?? null;

    ConsoleLogger.info(
      `Prod sync complete: inserted ${result.inserted}, skipped ${result.skipped}. Newest epoch: ${newestEpoch}`
    );

    return {
      success: true,
      epoch: newestEpoch,
      recordsInserted: result.inserted,
      recordsSkipped: result.skipped,
    };
  } catch (e) {
    const msg = `Prod sync error: ${e}`;
    ConsoleLogger.error(msg);
    if (e instanceof Error) {
      ConsoleLogger.error(`Error stack: ${e.stack}`);
    }
    return { success: false, errorMessage: msg };
  }
}
