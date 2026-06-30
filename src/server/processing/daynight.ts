import { hhmmssFromSeconds } from "utils/formatting";
import { getAppropriateTLE } from "store/ephemera";
import * as SunCalc from "utils/suncalc.js";
import { getSatelliteInfo } from "tle.js";
import getEphemera from "./ephemeris/ephemeris";
import { NtlmClient, NtlmCredentials } from "axios-ntlm";
import { isSameDate, midnightZulu, mmddyy } from "../../utils/date";
import ConsoleLogger from "utils/logging/consoleLogger";

type TopoState = "outOfRange_historic" | "historic" | "predicted" | "outOfRange_predicted";

type TopoURL = {
  state: TopoState;
  url: string | null;
};

/**
 * Get day night data.
 *
 * CALL ORDER AND FALLBACK LOGIC:
 * 1. Initial validation: If requested date is 50 or more days in future, return error immediately (out of TOPO range)
 *
 * 2. Primary source - TOPO (if not out of historic range):
 *    - Queries 3 weeks of data (week before, current week, week after) to ensure coverage
 *    - Each week attempts to fetch from Tuesday (normal upload day) through the next 7 days
 *    - Uses historic BET files for dates before today, predicted STP files for dates today through +49 days
 *    - Validates data has both morning and evening entries (detects partial/incomplete data)
 *    - If successful and has complete data, returns TOPO result
 *    - If fails or returns incomplete data, captures error and continues to fallback
 *
 * 3. Fallback source - Ephemera:
 *    - Only attempted if TOPO fails AND requested date is <= tomorrow midnight
 *    - Fetches ISS ephemera TLE data via getEphemera
 *    - Calculates day/night from ephemera TLE data at 5-second intervals
 *    - If successful and has data, returns ephemera-based result
 *    - If fails, returns error combining both TOPO and ephemera failure messages
 *
 * 4. Error conditions (in order of precedence):
 *    - Date >50 days future: Returns error, no fallback attempted
 *    - Date >tomorrow midnight: TOPO attempted but no ephemera fallback
 *    - TOPO + ephemera both fail: Returns combined error message
 *
 * @param dateWanted The date string in YYYY-MM-DD format
 * @param source The data source identifier
 * @returns data response of daynight objects
 */
export async function getDayNight({
  dateWanted,
}: {
  dateWanted: string;
}): Promise<FetchResponse<DayNightStore>> {
  const [year, month, date] = dateWanted.split("-").map((x) => parseInt(x, 10));
  /** Get data from topo for a single day.
   *  To do this, we need to query multiple files covering current week, week before, week after to ensure we get the requested date.
   *  Each raw week pulled from topo by attempting to retrieve a file for every day of the week starting on Tuesday
   *    (Tuesday is the day of the week the file is supposed to be uploaded.)
   *  All the file data is aggregated and parsed down to find the requested day.
   *  Then formatted into day/night and cached.
   */
  const requestDate = new Date(Date.UTC(year, month - 1, date));

  const fetchTopoDayNight = async (): Promise<DayNightStore> => {
    const topoFileData: string[] = [];

    // Query 3 weeks: previous, current, and next week
    for (let weekOffset = -1; weekOffset < 2; weekOffset++) {
      const weekDate = new Date(
        Date.UTC(
          requestDate.getUTCFullYear(),
          requestDate.getUTCMonth(),
          requestDate.getUTCDate() + weekOffset * 7
        )
      );

      const queryDate = getPreviousTuesday(weekDate);
      let topoData = "";

      // Try each day of the week (normally succeeds on Tuesday)
      for (let dayAttempt = 0; dayAttempt < 7; dayAttempt++) {
        const topoURL = getTopoURL(queryDate);

        if (topoURL.state === "outOfRange_historic" || topoURL.state === "outOfRange_predicted") {
          queryDate.setUTCDate(queryDate.getUTCDate() + 1);
          continue;
        }

        const credentials: NtlmCredentials = {
          username: process.env.TOPO_USER || "",
          password: process.env.TOPO_PASSWORD || "",
          domain: "",
        };

        const client = NtlmClient(credentials);

        try {
          const response = await client.get(topoURL.url!, {
            validateStatus: (status: number) => status === 200 || status === 404,
          });

          // Handle response based on status code
          if (response.status === 200) {
            // Success: response.data is already the body string
            topoData = response.data;
            break; // Got data for this week, move to next week
          }

          if (response.status === 404) {
            // File not found, try next day
            queryDate.setUTCDate(queryDate.getUTCDate() + 1);
            continue;
          }
        } catch (error) {
          // Unexpected error
          throw new Error(
            `TOPO fetch failed for URL ${topoURL.url}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
      topoFileData.push(topoData);
    }

    // Parse all the raw week files into day/night data
    const dayNight = parseTopoData(topoFileData, requestDate);
    return { dayNight };
  };

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const tomorrow = new Date(Date.now() + ONE_DAY_MS);
  const tomorrowMidnight = tomorrow.setUTCHours(0, 0, 0, 0);
  const topoState = getTopoState(requestDate);

  // Early exit: date too far in future
  if (topoState === "outOfRange_predicted") {
    return createErrorResponse("Requested date is too far in the future", "topo");
  }

  // Try TOPO if within range
  let topoError: string | undefined;
  if (topoState === "outOfRange_historic") {
    topoError = "Date is before TOPO historic range.";
  } else {
    try {
      const topoDayNight = await fetchTopoDayNight();
      if (topoDayNight?.dayNight?.length) {
        return createSuccessResponse(topoDayNight, "topo");
      }
      topoError = "TOPO returned no day/night data.";
    } catch (error) {
      topoError =
        error instanceof Error ? error.message : "Unknown error fetching TOPO day/night data";
      ConsoleLogger.warn("TOPO fetch failed, attempting fallback:", error);
    }
  }

  // Early exit: date too far in future for ephemera fallback
  if (requestDate.getTime() > tomorrowMidnight) {
    const errorMessage = `${topoError} Unable to failover to ISS Location because requested date is too far in the future.`;
    return createErrorResponse(errorMessage, "topo");
  }

  // Try ephemera fallback
  try {
    const dayNight = await calcDayNightFromTLE(year, month, date);
    if (dayNight?.length) {
      return createSuccessResponse({ dayNight }, "ephemeris_db");
    }
    const fallbackError = "ISS location returned no day/night data.";
    const combinedError = `${topoError}. ${fallbackError}`;
    return createErrorResponse(combinedError, "ephemeris_db");
  } catch (error) {
    const fallbackError =
      error instanceof Error ? error.message : "Unknown error fetching ISS location day/night data";
    ConsoleLogger.error("ISS location fallback failed:", error);
    const combinedError = `${topoError}. ${fallbackError}`;
    return createErrorResponse(combinedError, "ephemeris_db");
  }
}
export default getDayNight;

/** Helper function to create successful fetch responses */
function createSuccessResponse(data: DayNightStore, origin: string): FetchResponse<DayNightStore> {
  return {
    data,
    fetchMetadata: {
      success: true,
      error: undefined,
      timestamp: new Date().toISOString(),
    },
    origin,
  };
}

/** Helper function to create error fetch responses */
function createErrorResponse(message: string, origin?: string): FetchResponse<DayNightStore> {
  return {
    data: { dayNight: [] },
    fetchMetadata: {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    },
    origin,
  };
}

/** Calculate the previous Tuesday from a given date */
function getPreviousTuesday(date: Date): Date {
  const result = new Date(date);
  let daysSinceTuesday = result.getUTCDay() - 2;
  if (daysSinceTuesday < 0) daysSinceTuesday += 7;
  result.setUTCDate(result.getUTCDate() - daysSinceTuesday);
  return result;
}

/** Check if day/night data has both morning and evening entries (validates completeness) */
function hasCompleteData(dayNightArr: DayNightObj[]): boolean {
  const HALF_DAY_SECONDS = 43200; // 12 hours in seconds
  let hasMorning = false;
  let hasEvening = false;

  for (const entry of dayNightArr) {
    if (entry.appSeconds < HALF_DAY_SECONDS) hasMorning = true;
    if (entry.appSeconds >= HALF_DAY_SECONDS) hasEvening = true;
    if (hasMorning && hasEvening) return true;
  }

  return false;
}

/**
 * Takes in an array of fetch responses each containing raw topo week data and parses them into a daynight array.
 * @param topoFileData array of Response objects from topo
 * @param requestDate the date to look for in the responses
 * @returns a parsed array of the day night values for the given requestDate
 */
function parseTopoData(topoFileData: string[], requestDate: Date): DayNightObj[] {
  const dayNightArr: DayNightObj[] = [];
  let foundSTPfile = false; // Short term plan (predicted) file - only process once

  for (const fileData of topoFileData) {
    if (!fileData) continue;

    const lines = fileData.split("\n");

    // STP files contain complete days and may appear in multiple responses
    // Only process the first STP file to avoid duplicate data
    const isSTPfile = lines[0] === "topo52.ISS.sun_lighting_events.ascii";
    if (isSTPfile) {
      if (foundSTPfile) continue;
      foundSTPfile = true;
    }

    // Process each line in the file
    for (const line of lines) {
      // Skip non-data lines (headers/footers)
      if (isNaN(parseInt(line.trim().charAt(0)))) continue;

      // Parse columns (normalize whitespace first)
      const columns = line.trim().replace(/\s+/g, " ").split(" ");

      // Parse and validate date (column 0: year:month:day:hour:min:sec)
      const [year, month, day, hour, min, sec] = columns[0].split(":").map(Number);
      const lineDate = new Date(Date.UTC(year, month - 1, day));
      if (!isSameDate(requestDate, lineDate)) continue;

      // Parse sun lighting state (column 9)
      const sunState = getSunLighting(columns[9]);
      if (!sunState) continue; // Not a tracked state

      // Convert time to app seconds and add to array
      const appSeconds = hour * 3600 + min * 60 + Math.round(sec);
      dayNightArr.push({ appSeconds, daylight: sunState });
    }
  }

  // Validate we have complete data (both morning and evening entries)
  // Partial data can occur when BET data ends mid-day or during high beta angle season
  // Returning empty array triggers fallback to ISS location data
  if (!hasCompleteData(dayNightArr)) {
    return [];
  }

  // Add boundary entries at start (0 seconds) and end (86400 seconds) of the 24-hour period
  if (dayNightArr[0].appSeconds !== 0) {
    const firstState = dayNightArr[0].daylight;
    const inverseStates: Record<SunLighting, SunLighting> = {
      day: "sunrise",
      night: "sunset",
      sunrise: "night",
      sunset: "day",
    };
    const startState = inverseStates[firstState];
    if (!startState) {
      throw new Error(`Unexpected sun lighting value: ${firstState}`);
    }
    dayNightArr.unshift({ appSeconds: 0, daylight: startState });
  }

  const lastItem = dayNightArr[dayNightArr.length - 1];
  if (lastItem.appSeconds !== 86400) {
    dayNightArr.push({ appSeconds: 86400, daylight: lastItem.daylight });
  }

  return dayNightArr;
}

/**
 * Determines what TOPO url to use for a given topo state
 * @param date UTC
 * @returns TopoURL object with URL and State. URL is Null if date is out of range.
 */
export function getTopoURL(requestDate: Date): TopoURL {
  const topoState = getTopoState(requestDate);

  if (topoState === "outOfRange_predicted" || topoState === "outOfRange_historic") {
    // Date is out of range - no data available
    return { url: null, state: topoState };
  }

  if (topoState === "predicted") {
    // Use short term plan (STP) predicted data for dates within the next 50 days (today through +49)
    return {
      url: "https://fod2.jsc.nasa.gov/CM/TOPO/data/stp/topo52.ISS.sun_lighting_events.txt",
      state: topoState,
    };
  }

  // Historic data: use best estimated trajectory (BET) data
  const BET_EXT_CHANGE_DATE = new Date(Date.UTC(2015, 0, 5));
  const ext = requestDate.getTime() < BET_EXT_CHANGE_DATE.getTime() ? ".cff.txt" : ".cff.conv.txt";
  const year = requestDate.getUTCFullYear();
  const dateStr = mmddyy(requestDate);

  return {
    url: `https://fod2.jsc.nasa.gov/CM/TOPO/data/bet/Sun%20Lighting%20Data/As%20Flown/${year}/bet_data1_${dateStr}.ISS.sun_lighting_events${ext}`,
    state: topoState,
  };
}

/**
 * Determines what state the topo data is in for a given date.
 * As long as the state returned is not "outOfRange_" then data will be available on the topo server
 * @param requestDate the date to check
 * @returns the state of the data will be in when it is retrieved from the topo server
 */
export function getTopoState(requestDate: Date): TopoState {
  const HISTORIC_MIN = new Date(Date.UTC(2013, 2, 31)); // TOPO data cutoff date
  const PREDICTED_MAX_DAYS = 50; // Maximum days in future for predicted data

  const today = midnightZulu(new Date());
  const futureMax = new Date(today);
  futureMax.setUTCDate(today.getUTCDate() + PREDICTED_MAX_DAYS);

  const requestTime = requestDate.getTime();
  const todayTime = today.getTime();
  const futureMaxTime = futureMax.getTime();
  const historicMinTime = HISTORIC_MIN.getTime();

  if (requestTime >= futureMaxTime) return "outOfRange_predicted";
  if (requestTime >= todayTime) return "predicted";
  if (requestTime >= historicMinTime) return "historic";
  return "outOfRange_historic";
}

/**
 * Translates the sun acquisition flags from the topo raw data to the SunLighting type for day/night
 * @param sunAcquisition string representing a sun acquisition state from topo
 * @returns the SunLighting value for day night, or null if the state is not tracked
 */
function getSunLighting(sunAcquisition: string): SunLighting | null {
  switch (sunAcquisition) {
    case "Effective_Sunset":
      return "sunset";
    case "Full_Sunset":
      return "night";
    case "Start_Sunrise":
      return "sunrise";
    case "Start_Effective_Sunrise":
      return "day";
    default:
      return null; //this is a sun acquisition state we don't track
  }
}

/**
 * Calculate day night information by fetching ISS ephemera and computing sunlight status from TLE data.
 * Calculates day/night by checking sunlight status at 5-second intervals using satellite position and SunCalc.
 * @param year yyyy
 * @param month mm
 * @param date dd
 * @returns An array of day night objects. Each object in the array is a change in daylight state.
 */
async function calcDayNightFromTLE(
  year: number,
  month: number,
  date: number
): Promise<DayNightObj[]> {
  const dateWanted = `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
  const issLocation = await getEphemera({ dateWanted });

  // Validate ephemera data is available
  if (!issLocation.fetchMetadata.success || !issLocation.data?.length) {
    return [];
  }

  const ephemera = issLocation.data;
  const SECONDS_IN_DAY = 86400;
  const SAMPLE_INTERVAL = 5; // Check sunlight every 5 seconds
  const startDate = new Date(Date.UTC(year, month - 1, date));

  const dayNightObjArray: DayNightObj[] = [];
  let prevDaylight: boolean | null = null;

  for (let i = 0; i < SECONDS_IN_DAY; i += SAMPLE_INTERVAL) {
    const dateString = `${startDate.toISOString().split("T")[0]}T${hhmmssFromSeconds(i)}Z`;
    const currentDate = new Date(dateString);
    const tle = getAppropriateTLE(ephemera, currentDate.toISOString());
    const issInfo = getSatelliteInfo(tle, currentDate.getTime());

    const daylight = isSunlit(currentDate, issInfo.lng, issInfo.lat, issInfo.height * 1000);

    if (daylight !== prevDaylight) {
      const dayNightObj: DayNightObj = {
        appSeconds: i,
        daylight: daylight ? "day" : "night",
      };
      dayNightObjArray.push(dayNightObj);
    }

    prevDaylight = daylight;
  }

  // Add final entry at end of day
  dayNightObjArray.push({
    appSeconds: SECONDS_IN_DAY,
    daylight: "night",
  });

  return dayNightObjArray;
}

function isSunlit(date: Date, lng: number, lat: number, heightMeters: number): boolean {
  const sunTimes = SunCalc.getTimes(date, lat, lng, heightMeters);

  // Calculate sunlight end time (midpoint between sunset and golden hour)
  const sunlightEnd = new Date((sunTimes.sunset.getTime() + sunTimes.goldenHour.getTime()) / 2);

  // If sunrise/sunset are NaN, it's high beta angle season (sun never sets)
  if (isNaN(sunTimes.sunriseEnd.getTime()) || isNaN(sunlightEnd.getTime())) {
    return true;
  }

  // Check if current time is within daylight hours
  return date > sunTimes.sunriseEnd && date < sunlightEnd;
}
