/**
 * Celestrak API integration for fetching current ISS TLE data
 */
import fetchWithTimeout from "utils/fetch-with-timeout";
import { getEpochTimestamp } from "tle.js";
import ConsoleLogger from "utils/consoleLogger";
import { upsertEphemerisRecords } from "./ephemeris";

/**
 * Fetch latest TLE from Celestrak and update database
 * Skips update if epoch matches latest record in database
 */
export async function updateFromCelestrak(): Promise<void> {
  const queryURL = `https://celestrak.org/NORAD/elements/gp.php?CATNR=25544`;

  try {
    const res = await fetchWithTimeout(queryURL, { method: "GET" });

    const resText = await res.text();
    const lines = resText.split("\r\n");
    const tle = `${lines[0].trim()}
${lines[1].trim()}
${lines[2].trim()}`;

    // Calculate the epoch timestamp from the TLE data
    const epochMs = getEpochTimestamp(tle);

    // Validate epoch before creating Date
    if (!epochMs || isNaN(epochMs) || !isFinite(epochMs)) {
      const msg = `Invalid epoch timestamp from TLE: ${epochMs}`;
      ConsoleLogger.error(msg);
      return;
    }

    const epochDate = new Date(epochMs);
    if (isNaN(epochDate.getTime())) {
      const msg = `Unable to create valid Date from epoch: ${epochMs}`;
      ConsoleLogger.error(msg);
      return;
    }

    // Insert new TLE into database (upsert will skip if duplicate)
    await upsertEphemerisRecords({
      records: [
        {
          epoch: epochDate.toISOString(),
          tle_line1: lines[1].trim(),
          tle_line2: lines[2].trim(),
        },
      ],
      origin: "celestrak",
    });
  } catch (e) {
    const msg = `Error fetching/updating Celestrak ephemeris: ${e}`;
    ConsoleLogger.error(msg);
  }
}
