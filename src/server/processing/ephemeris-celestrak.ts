/**
 * Celestrak API integration for fetching current ISS TLE data
 */
import fetchWithTimeout from "utils/fetch-with-timeout";
import { getEpochTimestamp } from "tle.js";
import ConsoleLogger from "utils/logging/consoleLogger";
import { upsertEphemerisRecords } from "./ephemeris";

/**
 * Fetch latest TLE from Celestrak and update database
 * Skips update if epoch matches latest record in database
 * Returns the epoch from the fetched TLE data
 */
export async function updateFromCelestrak(): Promise<CelestrakUpdateResult> {
  const queryURL = `https://celestrak.org/NORAD/elements/gp.php?CATNR=25544`;

  try {
    ConsoleLogger.info(`Initiating Celestrak fetch from: ${queryURL}`);
    ConsoleLogger.info(
      `Environment check - NODE_ENV: ${process.env.NODE_ENV}, hostname: ${process.env.HOSTNAME ?? "undefined"}`
    );

    const res = await fetchWithTimeout(queryURL, { method: "GET" });

    // Debug: Log response status
    ConsoleLogger.info(`Celestrak API response status: ${res.status} ${res.statusText}`);
    const headersObj: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headersObj[key] = value;
    });
    ConsoleLogger.info(`Celestrak API response headers: ${JSON.stringify(headersObj)}`);

    if (!res.ok) {
      const errorBody = await res.text();
      const msg = `Celestrak API returned non-OK status: ${res.status} ${res.statusText}. Body: ${errorBody.substring(0, 500)}`;
      ConsoleLogger.error(msg);
      return { success: false, errorMessage: msg };
    }

    const resText = await res.text();

    // Debug: Log raw response details
    ConsoleLogger.info(`Celestrak API raw response length: ${resText.length} characters`);
    ConsoleLogger.info(
      `Celestrak API raw response (first 500 chars): ${resText.substring(0, 500)}`
    );
    ConsoleLogger.info(
      `Celestrak API raw response (last 200 chars): ${resText.substring(Math.max(0, resText.length - 200))}`
    );

    // Try multiple line ending formats
    let lines = resText.split("\r\n");
    if (lines.length < 3) {
      ConsoleLogger.info(`Split by \\r\\n produced ${lines.length} lines, trying \\n`);
      lines = resText.split("\n");
    }
    if (lines.length < 3) {
      ConsoleLogger.info(`Split by \\n produced ${lines.length} lines, trying \\r`);
      lines = resText.split("\r");
    }

    // Debug: Log parsed lines
    ConsoleLogger.info(`Celestrak API parsed lines count: ${lines.length}`);
    lines.forEach((line, idx) => {
      ConsoleLogger.info(`Line ${idx}: "${line}" (length: ${line?.length ?? "undefined"})`);
    });

    // Validate we have at least 3 lines
    if (lines.length < 3) {
      const msg = `Celestrak API returned insufficient lines: expected 3+, got ${lines.length}. Response text: ${resText.substring(0, 1000)}`;
      ConsoleLogger.error(msg);
      return { success: false, errorMessage: msg };
    }

    // Validate lines are defined before calling trim
    if (lines[0] === undefined || lines[1] === undefined || lines[2] === undefined) {
      const msg = `Celestrak API lines are undefined: [0]=${lines[0]}, [1]=${lines[1]}, [2]=${lines[2]}`;
      ConsoleLogger.error(msg);
      return { success: false, errorMessage: msg };
    }

    const tle = `${lines[0].trim()}
${lines[1].trim()}
${lines[2].trim()}`;

    ConsoleLogger.info(`Constructed TLE:\n${tle}`);

    // Calculate the epoch timestamp from the TLE data
    const epochMs = getEpochTimestamp(tle);

    // Validate epoch before creating Date
    if (!epochMs || isNaN(epochMs) || !isFinite(epochMs)) {
      const msg = `Invalid epoch timestamp from TLE: ${epochMs}`;
      ConsoleLogger.error(msg);
      return { success: false, errorMessage: msg };
    }

    const epochDate = new Date(epochMs);
    if (isNaN(epochDate.getTime())) {
      const msg = `Unable to create valid Date from epoch: ${epochMs}`;
      ConsoleLogger.error(msg);
      return { success: false, errorMessage: msg };
    }

    const epochIso = epochDate.toISOString();

    ConsoleLogger.info(`Ephemeris epoch parsed: ${epochIso}`);

    // Validate TLE lines before inserting
    const line1 = lines[1]?.trim();
    const line2 = lines[2]?.trim();

    if (!line1 || !line2) {
      const msg = `Invalid TLE lines after trim: line1="${line1}", line2="${line2}"`;
      ConsoleLogger.error(msg);
      return { success: false, errorMessage: msg };
    }

    ConsoleLogger.info(
      `Inserting ephemeris record with epoch: ${epochIso}, line1 length: ${line1.length}, line2 length: ${line2.length}`
    );

    // Insert new TLE into database (upsert will skip if duplicate)
    await upsertEphemerisRecords({
      records: [
        {
          epoch: epochIso,
          tle_line1: line1,
          tle_line2: line2,
        },
      ],
      origin: "celestrak",
    });

    ConsoleLogger.info(`Successfully updated Celestrak ephemeris with epoch: ${epochIso}`);
    return { success: true, epoch: epochIso };
  } catch (e) {
    const msg = `Error fetching/updating Celestrak ephemeris: ${e}`;
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
