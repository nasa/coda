/**
 * Space-Track API integration for fetching ISS TLE data
 *
 * Uses the optimized `gp` class per Space-Track's API guidelines, filtered to
 * NORAD_CAT_ID 25544 (ISS) with CREATION_DATE > now-1 day. The 24-hour window
 * gives 4x overlap with the 6-hour scheduler, so even if several consecutive
 * fetches fail we won't miss any TLE records.
 *
 * IMPORTANT: Space-Track has strict rate limiting policies. Only the prod
 * instance should call this module — non-prod instances pull ephemeris via
 * ephemeris-sync.ts. See spacetrackScheduler.ts for the dispatch.
 */
import fetchWithTimeout from "utils/fetch-with-timeout";
import { getEpochTimestamp } from "tle.js";
import ConsoleLogger from "utils/logging/consoleLogger";
import { upsertEphemerisRecords } from "./ephemeris";

const LOGIN_URL = "https://www.space-track.org/ajaxauth/login";
const API_BASE_URL = "https://www.space-track.org/basicspacedata/query";
const ISS_NORAD_ID = 25544;

/**
 * Parse precise epoch from TLE line1
 * TLE epoch is more accurate than the JSON epoch field - recalculate from line1
 */
export function calculateEpochFromTLE(line1: string, line2: string): Date | null {
  try {
    // Create a minimal 3-line TLE format (name can be anything)
    const tle = `ISS (ZARYA)\n${line1}\n${line2}`;
    const epochMs = getEpochTimestamp(tle);

    if (!epochMs || isNaN(epochMs) || !isFinite(epochMs)) {
      ConsoleLogger.error(`Invalid epoch from TLE: ${epochMs}`);
      return null;
    }

    const epochDate = new Date(epochMs);
    if (isNaN(epochDate.getTime())) {
      ConsoleLogger.error(`Unable to create valid Date from epoch: ${epochMs}`);
      return null;
    }

    return epochDate;
  } catch (e) {
    ConsoleLogger.error(`Error calculating epoch from TLE: ${e}`);
    return null;
  }
}

/**
 * Authenticate with Space-Track
 * Returns the cookie strings to pass in subsequent requests, or null on failure.
 */
async function loginToSpaceTrack(): Promise<string[] | null> {
  const username = process.env.SPACETRACK_USERNAME;
  const password = process.env.SPACETRACK_PASSWORD;

  if (!username || !password) {
    ConsoleLogger.error(
      "Space-Track credentials not configured. Set SPACETRACK_USERNAME and SPACETRACK_PASSWORD environment variables."
    );
    return null;
  }

  try {
    ConsoleLogger.info("Authenticating with Space-Track.org...");

    const formData = new URLSearchParams();
    formData.append("identity", username);
    formData.append("password", password);

    const response = await fetchWithTimeout(LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "CODA_TLE_Fetcher/1.0",
      },
      body: formData.toString(),
    });

    // Extract cookies from response
    // This login cookie is only valid for 2 hours (Max-Age=7200)
    const setCookieHeaders = response.headers.getSetCookie?.() || [];
    ConsoleLogger.debug(
      `Space-Track login Set-Cookie headers: ${JSON.stringify(setCookieHeaders)}`
    );
    const cookies = setCookieHeaders.map((cookie) => cookie.split(";")[0]);

    if (!response.ok) {
      const errorText = await response.text();
      ConsoleLogger.error(
        `Space-Track login failed: ${response.status} ${response.statusText}. Body: ${errorText.substring(0, 500)}`
      );
      return null;
    }

    const responseText = await response.text();

    // Check for error in JSON response
    try {
      const jsonResponse = JSON.parse(responseText);
      if (jsonResponse.error) {
        ConsoleLogger.error(`Space-Track login error: ${jsonResponse.error}`);
        return null;
      }
    } catch {
      // Response is not JSON, check for logout link as fallback
      if (!responseText.toLowerCase().includes("logout")) {
        ConsoleLogger.error("Space-Track login failed: unexpected response format");
        return null;
      }
    }

    ConsoleLogger.info("Successfully authenticated with Space-Track.org");
    return cookies;
  } catch (e) {
    ConsoleLogger.error(`Space-Track login error: ${e}`);
    return null;
  }
}

/**
 * Fetch the latest ISS TLE records from Space-Track.
 * Logs in fresh on every call since the poll interval exceeds the session lifetime.
 */
async function fetchTLEFromSpaceTrack(): Promise<SpaceTrackGpRecord[] | null> {
  const loginCookies = await loginToSpaceTrack();
  if (!loginCookies) return null;

  // Per Space-Track API guidelines: use the optimized `gp` class for current ephemerides.
  // CREATION_DATE/>now-1 = TLEs created in the last 24 hours (4x overlap with 6h scheduler).
  // decay_date/null-val excludes decayed objects (harmless for ISS, matches their template).
  const orderBy = "orderby/CREATION_DATE%20desc";
  const predicates = "predicates/TLE_LINE1,TLE_LINE2";
  const query = `/class/gp/NORAD_CAT_ID/${ISS_NORAD_ID}/decay_date/null-val/CREATION_DATE/%3Enow-1/${orderBy}/format/json/${predicates}`;
  const url = `${API_BASE_URL}${query}`;

  ConsoleLogger.info("Fetching latest ISS TLEs from Space-Track (gp class, 24h window)");
  ConsoleLogger.debug(`Request URL: ${url}`);

  try {
    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        "User-Agent": "CODA_TLE_Fetcher/1.0",
        Cookie: loginCookies.join("; "),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      ConsoleLogger.error(
        `Space-Track API error: ${response.status} ${response.statusText}. Body: ${errorText.substring(0, 500)}`
      );
      return null;
    }

    const data: SpaceTrackGpRecord[] = await response.json();
    ConsoleLogger.info(`Retrieved ${data.length} TLE records from Space-Track`);
    return data;
  } catch (e) {
    ConsoleLogger.error(`Space-Track API fetch error: ${e}`);
    return null;
  }
}

/**
 * Fetch the latest ISS TLE records from Space-Track and update database.
 * Returns information about the latest epoch from the fetched TLE data.
 *
 * IMPORTANT: This function should only be called by the prod instance, on the
 * configured interval (6 hours). Space-Track has strict rate limiting and will
 * suspend accounts that make too many requests.
 */
export async function updateFromSpaceTrack(): Promise<SpaceTrackUpdateResult> {
  try {
    ConsoleLogger.info(
      `Initiating Space-Track fetch - NODE_ENV: ${process.env.NODE_ENV}, hostname: ${process.env.HOSTNAME ?? "undefined"}`
    );

    const tleRecords = await fetchTLEFromSpaceTrack();

    if (!tleRecords) {
      const msg = "Failed to fetch TLE data from Space-Track";
      ConsoleLogger.error(msg);
      return { success: false, errorMessage: msg };
    }

    if (tleRecords.length === 0) {
      const msg = "Space-Track returned no TLE records";
      ConsoleLogger.warn(msg);
      return { success: false, errorMessage: msg };
    }

    // Process records and calculate epochs from TLE data
    const processedRecords: Array<{
      epoch: string;
      tle_line1: string;
      tle_line2: string;
    }> = [];

    let latestEpoch: Date | null = null;
    let skippedRecords = 0;

    for (const record of tleRecords) {
      const line1 = record.TLE_LINE1?.trim();
      const line2 = record.TLE_LINE2?.trim();

      if (!line1 || !line2) {
        ConsoleLogger.warn(
          `Skipping record with missing TLE lines: ${JSON.stringify(record).substring(0, 200)}`
        );
        skippedRecords++;
        continue;
      }

      const epoch = calculateEpochFromTLE(line1, line2);
      if (!epoch) {
        ConsoleLogger.warn(`Skipping record with invalid epoch calculation`);
        skippedRecords++;
        continue;
      }

      processedRecords.push({
        epoch: epoch.toISOString(),
        tle_line1: line1,
        tle_line2: line2,
      });

      // Track latest epoch
      if (!latestEpoch || epoch > latestEpoch) {
        latestEpoch = epoch;
      }
    }

    if (processedRecords.length === 0) {
      const msg = "No valid TLE records after processing";
      ConsoleLogger.error(msg);
      return { success: false, errorMessage: msg };
    }

    ConsoleLogger.info(
      `Processing ${processedRecords.length} valid records (skipped ${skippedRecords})`
    );

    // Upsert all records to database
    const result = await upsertEphemerisRecords({
      records: processedRecords,
      origin: "spacetrack",
    });

    const latestEpochIso = latestEpoch?.toISOString() ?? null;

    ConsoleLogger.info(
      `Successfully updated Space-Track ephemeris: inserted ${result.inserted}, skipped ${result.skipped} duplicates. Latest epoch: ${latestEpochIso}`
    );

    return {
      success: true,
      epoch: latestEpochIso,
      recordsInserted: result.inserted,
      recordsSkipped: result.skipped,
    };
  } catch (e) {
    const msg = `Error fetching/updating Space-Track ephemeris: ${e}`;
    ConsoleLogger.error(msg);

    // Enhanced error logging
    if (e instanceof Error) {
      ConsoleLogger.error(`Error name: ${e.name}`);
      ConsoleLogger.error(`Error message: ${e.message}`);
      ConsoleLogger.error(`Error stack: ${e.stack}`);
    } else {
      ConsoleLogger.error(`Non-Error object thrown: ${JSON.stringify(e)}`);
    }

    return { success: false, errorMessage: msg };
  }
}
