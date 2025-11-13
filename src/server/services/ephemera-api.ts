/**
 * Use space-track.org to find the location of ISS at any point in time
 * See https://www.space-track.org/documentation
 */
import fetchWithTimeout from "utils/fetch-with-timeout";
import { padZeros } from "utils/formatting";
import { getEpochTimestamp } from "tle.js";
import { isSameDate } from "../../utils/date";
import ConsoleLogger from "utils/logger";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function fetchSpacetrack(
  year: number,
  month: number,
  date: number
): Promise<EphemerisFile[]> {
  const isLocal = process.env.VITE_PUBLIC_APP_ENV === "local";

  if (isLocal) {
    ConsoleLogger.log("Mocking request for fetchSpacetrack()");
    let mockSpacetrackData: EphemerisFile[] = require("../../../mocks/fakedata/ephemera.json");

    // mock the request with local data
    const mockResult = await Promise.resolve(mockSpacetrackData);
    return mockResult;
  }

  // 2024-12-19 space-track.org now requires two step call. first call to login and returns a cookie with a token in it. 2nd call uses that token to make the actual request.

  const loginUrl = "https://www.space-track.org/ajaxauth/login";
  const loginBody = `identity=${process.env.SPACETRACK_USER}&password=${process.env.SPACETRACK_PASSWORD}`;

  let loginRes: Response;
  try {
    loginRes = await fetchWithTimeout(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: loginBody,
    });
  } catch (e) {
    return [];
  }

  // Extract the cookie from the response headers
  const cookies = loginRes.headers.get("set-cookie");

  // If login failed, return empty array
  if (!cookies) {
    return [];
  }

  // if login succeeded, make the actual request using the session token

  const dateParam = `${padZeros(year, 2)}-${padZeros(month, 2)}-${padZeros(date, 2)}`;
  const queryURL = `https://www.space-track.org/basicspacedata/query/class/tle/NORAD_CAT_ID/25544/EPOCH/>${dateParam}%2000:00:00,<${dateParam}%2023:59:59/orderby/EPOCH%20desc/limit/100/emptyresult/show`;

  try {
    const res = await fetchWithTimeout(queryURL, {
      method: "GET",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookies,
      },
    });

    return (await res.json()) as EphemerisFile[];
  } catch (e) {
    console.error(e);
    // serverLogger.error(e as Error, {
    //   logId: "spacetrack-api-hit",
    //   message: "Spacetrack API unavailable",
    // });
  }
  return [];
}

/**
 * Hit the celestrak endpoing to return the latest TLE element for ISS
 */
async function fetchCelestrakToday() {
  // end point for today's TLE for ISS
  const queryURL = `https://celestrak.org/NORAD/elements/gp.php?CATNR=25544`;
  try {
    const res = await fetchWithTimeout(queryURL, {
      method: "GET",
    });

    const resText = await res.text();
    const lines = resText.split("\r\n");
    const tle = `${lines[0].trim()}
    ${lines[1].trim()}
    ${lines[2].trim()}`;

    // Calculate the epoch timestamp from the TLE data
    const epoch = getEpochTimestamp(tle);

    // Validate epoch before creating Date
    if (!epoch || isNaN(epoch) || !isFinite(epoch)) {
      ConsoleLogger.error(`Invalid epoch timestamp from TLE: ${epoch}`);
      return null;
    }

    const epochDate = new Date(epoch);
    if (isNaN(epochDate.getTime())) {
      ConsoleLogger.error(`Unable to create valid Date from epoch: ${epoch}`);
      return null;
    }

    const epochString = epochDate.toISOString().split("Z")[0];

    const result: EphemerisFile = {
      EPOCH: epochString,
      TLE_LINE0: lines[0].trim(),
      TLE_LINE1: lines[1].trim(),
      TLE_LINE2: lines[2].trim(),
    };

    return result;
  } catch (e) {
    console.error(e);
  }
  return null;
}

/**
 * Get spacetrack ephemeris data for ISS. If the request is for today, get new data. If the request is for a day in the past, always return cached data if we have it
 * @param year yyyy
 * @param month 1-indexed, eg. `1` for Jan, `2` for Feb, etc.
 * @param date day of the month
 * @param ephemerisSource Manually specify the data source for this fetch. Bypasses cached fallbacks.
 * @returns DataResponse containing ephemeris data and fetch metadata.
 */
export async function fetchISSLocation(
  year: number,
  month: number,
  date: number,
  ephemerisSource?: string
): Promise<FetchResponse<EphemerisStore>> {
  const now = new Date();
  const requestDate = new Date(Date.UTC(year, month - 1, date));
  const isToday = isSameDate(now, requestDate);
  const defaultData: EphemerisStore = { ephemera: [] };

  const createSuccessResponse = (data: EphemerisStore, source: string) => {
    const timestamp = new Date().toISOString();
    const response: FetchResponse<EphemerisStore> = {
      data,
      fetchMetadata: {
        success: true,
        error: undefined,
        timestamp,
      },
      source,
    };
    return response;
  };

  const createErrorResponse = (message: string, source?: string) => {
    const timestamp = new Date().toISOString();
    const response: FetchResponse<EphemerisStore> = {
      data: defaultData,
      fetchMetadata: {
        success: false,
        error: message,
        timestamp,
      },
      source,
    };
    return response;
  };

  const getCelestrakEphemera = async (): Promise<EphemerisStore | null> => {
    const celestrakResult = await fetchCelestrakToday();
    if (celestrakResult) {
      return { ephemera: [celestrakResult] };
    }
    return null;
  };

  const getSpacetrackEphemera = async (): Promise<EphemerisStore> => {
    let dateToGet = new Date(requestDate.getTime());
    let count = 0;
    let numResults = 0;
    let spacetrackResults: EphemerisFile[] = [];

    while (numResults === 0 && count < 10) {
      spacetrackResults = await fetchSpacetrack(
        dateToGet.getUTCFullYear(),
        dateToGet.getUTCMonth() + 1,
        dateToGet.getUTCDate()
      );

      numResults = spacetrackResults.length;
      if (numResults === 0) {
        dateToGet = new Date(dateToGet.getTime() - ONE_DAY_MS);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      count++;
    }

    const ephemera: EphemerisFile[] = spacetrackResults.map((result) => ({
      EPOCH: result.EPOCH,
      TLE_LINE0: result.TLE_LINE0,
      TLE_LINE1: result.TLE_LINE1,
      TLE_LINE2: result.TLE_LINE2,
    }));

    return { ephemera };
  };

  const handleExplicitSource = async (): Promise<FetchResponse<EphemerisStore> | null> => {
    if (!ephemerisSource) return null;

    if (ephemerisSource === "spacetrack") {
      try {
        const spacetrackStore = await getSpacetrackEphemera();
        if (spacetrackStore.ephemera.length > 0) {
          return createSuccessResponse(spacetrackStore, "spacetrack");
        }
        return createErrorResponse("Spacetrack returned no ephemera.", "spacetrack");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error fetching spacetrack ephemera.";
        ConsoleLogger.error(`Spacetrack override failed: ${message}`);
        return createErrorResponse(message, "spacetrack");
      }
    }

    if (ephemerisSource === "celestrak") {
      if (!isToday) {
        return createErrorResponse("Celestrak can only be queried for today's date", "celestrak");
      }
      try {
        const celestrakStore = await getCelestrakEphemera();
        if (celestrakStore?.ephemera?.length) {
          return createSuccessResponse(celestrakStore, "celestrak");
        }
        return createErrorResponse("Celestrak returned no ephemera.", "celestrak");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error fetching celestrak ephemera.";
        ConsoleLogger.error(`Celestrak override failed: ${message}`);
        return createErrorResponse(message, "celestrak");
      }
    }

    return createErrorResponse("Unrecognized source");
  };

  const explicitResponse = await handleExplicitSource();
  if (explicitResponse) {
    return explicitResponse;
  }

  let celestrakError: string | undefined;
  if (isToday) {
    try {
      const celestrakStore = await getCelestrakEphemera();
      if (celestrakStore?.ephemera?.length) {
        return createSuccessResponse(celestrakStore, "celestrak");
      }
      celestrakError = "Celestrak returned no ephemera.";
    } catch (error) {
      celestrakError =
        error instanceof Error ? error.message : "Unknown error fetching celestrak ephemera.";
      ConsoleLogger.error(`Celestrak fetch failed: ${celestrakError}`);
    }
  }

  try {
    const spacetrackStore = await getSpacetrackEphemera();
    if (spacetrackStore.ephemera.length > 0) {
      return createSuccessResponse(spacetrackStore, "spacetrack");
    }
    const message = "Spacetrack returned no ephemera.";
    const combinedMessage = celestrakError ? `${celestrakError} ${message}` : message;
    return createErrorResponse(combinedMessage.trim(), "spacetrack");
  } catch (error) {
    const spacetrackError =
      error instanceof Error ? error.message : "Unknown error fetching spacetrack ephemera.";
    ConsoleLogger.error(`Spacetrack fetch failed: ${spacetrackError}`);
    const combinedMessage = celestrakError
      ? `${celestrakError} ${spacetrackError}`
      : spacetrackError;
    return createErrorResponse(combinedMessage.trim(), "spacetrack");
  }
}
