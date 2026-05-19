/**
 * Pull new ISS TLE records from another CODA instance's
 * /api/v1/db/ephemeris/recent endpoint.
 *
 * Should be used by non-prod CODA instances (int, dev, feature branches) instead of
 * polling Space-Track directly. Activated when EPHEMERIS_SYNC_FROM_URL is set;
 * the spacetrackScheduler dispatches to this function in place of
 * updateFromSpaceTrack on those instances.
 */
import fetchWithTimeout from "utils/fetch-with-timeout";
import ConsoleLogger from "utils/logging/consoleLogger";
import { upsertEphemerisRecords } from "./ephemeris";
import { getORM } from "server/express/global";
import { Ephemeris_db } from "server/database/models/ephemera.model";

export async function syncEphemerisFromRemote(): Promise<SpaceTrackUpdateResult> {
  const baseUrl = process.env.EPHEMERIS_SYNC_FROM_URL;
  const token = process.env.EMSS_TOKEN;

  if (!baseUrl) {
    return { success: false, errorMessage: "EPHEMERIS_SYNC_FROM_URL not set" };
  }
  if (!token) {
    return {
      success: false,
      errorMessage: "EMSS_TOKEN not set; cannot authenticate to sync source",
    };
  }

  try {
    const latestEpoch = await getLatestEpoch();
    const sinceParam = latestEpoch ? `?since=${encodeURIComponent(latestEpoch.toISOString())}` : "";
    const url = `${baseUrl.replace(/\/$/, "")}/api/v1/db/ephemeris/recent${sinceParam}`;

    ConsoleLogger.info(
      `Syncing ephemeris from ${baseUrl} (since=${latestEpoch ? latestEpoch.toISOString() : "<empty DB, default 30d>"})`
    );

    // 30s timeout to accommodate larger first-time payloads on empty DBs.
    const response = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent": "CODA_Ephemeris_Sync/1.0",
          "x-api-key": token,
        },
      },
      30000
    );

    if (!response.ok) {
      const errorText = await response.text();
      const msg = `Ephemeris sync HTTP ${response.status} ${response.statusText}: ${errorText.substring(0, 300)}`;
      ConsoleLogger.error(msg);
      return { success: false, errorMessage: msg };
    }

    const records: EphemerisEntry[] = await response.json();

    if (!Array.isArray(records)) {
      const msg = "Ephemeris sync response was not an array";
      ConsoleLogger.error(msg);
      return { success: false, errorMessage: msg };
    }

    if (records.length === 0) {
      ConsoleLogger.info("Ephemeris sync: already up to date (0 new records)");
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
      `Ephemeris sync complete: inserted ${result.inserted}, skipped ${result.skipped}. Newest epoch: ${newestEpoch}`
    );

    return {
      success: true,
      epoch: newestEpoch,
      recordsInserted: result.inserted,
      recordsSkipped: result.skipped,
    };
  } catch (e) {
    const msg = `Ephemeris sync error: ${e}`;
    ConsoleLogger.error(msg);
    if (e instanceof Error) {
      ConsoleLogger.error(`Error stack: ${e.stack}`);
    }
    return { success: false, errorMessage: msg };
  }
}

/**
 * Get the epoch of the newest TLE record in the local DB.
 * Used as the `since` parameter so we only fetch records newer than what we already have.
 */
export async function getLatestEpoch(): Promise<Date | null> {
  const em = getORM().em.fork();
  return (
    (await em.find(Ephemeris_db, {}, { orderBy: { epoch: "DESC" }, limit: 1 }))[0]?.epoch || null
  );
}
