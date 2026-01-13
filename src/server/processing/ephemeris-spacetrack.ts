/**
 * Space-Track API integration for fetching ISS TLE data
 *
 * Fetches the last 30 days of TLE data from Space-Track.org in a single call.
 * Uses the gp_history class which replaced the deprecated tle class.
 *
 * IMPORTANT: Space-Track has strict rate limiting policies. This module should only
 * be called on the configured interval (6 hours). Do not call during development
 * testing unless absolutely necessary.
 */
import fetchWithTimeout from "utils/fetch-with-timeout";
import { getEpochTimestamp } from "tle.js";
import ConsoleLogger from "utils/logging/consoleLogger";
import { upsertEphemerisRecords } from "./ephemeris";

const LOGIN_URL = "https://www.space-track.org/ajaxauth/login";
const API_BASE_URL = "https://www.space-track.org/basicspacedata/query";
const ISS_NORAD_ID = 25544;
const DAYS_TO_FETCH = 30;

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
 * Space-Track session manager with authentication
 * Maintains cookies across requests for authenticated access
 */
class SpaceTrackSession {
  private cookies: string[] = [];
  private isAuthenticated = false;

  async login(): Promise<boolean> {
    const username = process.env.SPACETRACK_USERNAME;
    const password = process.env.SPACETRACK_PASSWORD;

    if (!username || !password) {
      ConsoleLogger.error(
        "Space-Track credentials not configured. Set SPACETRACK_USERNAME and SPACETRACK_PASSWORD environment variables."
      );
      return false;
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
      const setCookieHeaders = response.headers.getSetCookie?.() || [];
      if (setCookieHeaders.length > 0) {
        this.cookies = setCookieHeaders.map((cookie) => cookie.split(";")[0]);
      }

      if (!response.ok) {
        const errorText = await response.text();
        ConsoleLogger.error(
          `Space-Track login failed: ${response.status} ${response.statusText}. Body: ${errorText.substring(0, 500)}`
        );
        return false;
      }

      const responseText = await response.text();

      // Check for error in JSON response
      try {
        const jsonResponse = JSON.parse(responseText);
        if (jsonResponse.error) {
          ConsoleLogger.error(`Space-Track login error: ${jsonResponse.error}`);
          return false;
        }
      } catch {
        // Response is not JSON, check for logout link as fallback
        if (!responseText.toLowerCase().includes("logout")) {
          ConsoleLogger.error("Space-Track login failed: unexpected response format");
          return false;
        }
      }

      this.isAuthenticated = true;
      ConsoleLogger.info("Successfully authenticated with Space-Track.org");
      return true;
    } catch (e) {
      ConsoleLogger.error(`Space-Track login error: ${e}`);
      return false;
    }
  }

  async fetchTLE(startDate: string, endDate: string): Promise<SpaceTrackGpHistoryRecord[] | null> {
    if (!this.isAuthenticated) {
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        return null;
      }
    }

    // Build query URL for gp_history class
    // Format: /class/gp_history/EPOCH/startDate--endDate/NORAD_CAT_ID/25544/orderby/EPOCH asc/format/json
    // Use predicates to limit response to only the fields we need (reduces data transfer significantly)
    const orderBy = "orderby/EPOCH%20asc";
    const predicates = "predicates/TLE_LINE1,TLE_LINE2";
    const query = `/class/gp_history/EPOCH/${startDate}--${endDate}/NORAD_CAT_ID/${ISS_NORAD_ID}/${orderBy}/${predicates}/format/json`;
    const url = `${API_BASE_URL}${query}`;

    ConsoleLogger.info(`Fetching TLE data from Space-Track: ${startDate} to ${endDate}`);
    ConsoleLogger.debug(`Request URL: ${url}`);

    try {
      const response = await fetchWithTimeout(url, {
        method: "GET",
        headers: {
          "User-Agent": "CODA_TLE_Fetcher/1.0",
          Cookie: this.cookies.join("; "),
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        ConsoleLogger.error(
          `Space-Track API error: ${response.status} ${response.statusText}. Body: ${errorText.substring(0, 500)}`
        );
        // Reset authentication state if we get 401/403
        if (response.status === 401 || response.status === 403) {
          this.isAuthenticated = false;
        }
        return null;
      }

      const data: SpaceTrackGpHistoryRecord[] = await response.json();
      ConsoleLogger.info(`Retrieved ${data.length} TLE records from Space-Track`);
      return data;
    } catch (e) {
      ConsoleLogger.error(`Space-Track API fetch error: ${e}`);
      return null;
    }
  }
}

// Singleton session instance
let spaceTrackSession: SpaceTrackSession | null = null;

/**
 * Get or create the Space-Track session
 */
function getSession(): SpaceTrackSession {
  if (!spaceTrackSession) {
    spaceTrackSession = new SpaceTrackSession();
  }
  return spaceTrackSession;
}

/**
 * Fetch last 30 days of TLE data from Space-Track and update database
 * Returns information about the latest epoch from the fetched TLE data
 *
 * IMPORTANT: This function should only be called on the configured interval
 * (6 hours). Space-Track has strict rate limiting and will ban IPs that
 * make too many requests.
 */
export async function updateFromSpaceTrack(): Promise<SpaceTrackUpdateResult> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - DAYS_TO_FETCH);

  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];

  try {
    ConsoleLogger.info(`Initiating Space-Track fetch for ${DAYS_TO_FETCH} days of TLE data`);
    ConsoleLogger.info(
      `Environment check - NODE_ENV: ${process.env.NODE_ENV}, hostname: ${process.env.HOSTNAME ?? "undefined"}`
    );

    const session = getSession();
    const tleRecords = await session.fetchTLE(startDateStr, endDateStr);

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
