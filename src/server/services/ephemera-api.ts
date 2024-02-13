/**
 * Use space-track.org to find the location of ISS at any point in time
 * See https://www.space-track.org/documentation
 */
import { isSameDate } from "store/playhead";
import fetchWithTimeout from "utils/fetch-with-timeout";
import { padZeros } from "utils/formatting";
import fetchWithCache from "./cache-client";
import { getEpochTimestamp } from "tle.js";
import { CacheFolder } from "utils/enums";

const oneYearInSeconds = 31536000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SPACETRACK_LOGIN = "https://www.space-track.org/ajaxauth/login";

async function fetchSpacetrack(
  year: number,
  month: number,
  date: number
): Promise<EphemerisFile[]> {
  const isLocal = process.env.VITE_PUBLIC_APP_ENV === "local";

  if (isLocal) {
    console.log("Mocking request for fetchSpacetrack()");
    let mockSpacetrackData: EphemerisFile[] = require("../../../mocks/fakedata/ephemera.json");

    // mock the request with local data
    const mockResult = await Promise.resolve(mockSpacetrackData);
    return mockResult;
  }

  const dateParam = `${padZeros(year, 2)}-${padZeros(month, 2)}-${padZeros(date, 2)}`;
  const queryURL = `https://www.space-track.org/basicspacedata/query/class/tle/NORAD_CAT_ID/25544/EPOCH/>${dateParam}%2000:00:00,<${dateParam}%2023:59:59/orderby/EPOCH%20desc/limit/100/emptyresult/show`;
  const body = `identity=${process.env.SPACETRACK_USER}&password=${process.env.SPACETRACK_PASSWORD}&query=${queryURL}`;

  try {
    const res = await fetchWithTimeout(SPACETRACK_LOGIN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    return (await res.json()) as EphemerisFile[];
  } catch (e) {
    console.error(e);
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
    const epochString = new Date(epoch).toISOString().split("Z")[0];

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
 * @param forceRetriever Return the cached data, then force the retriever function to get new data regardless of cache age.
 * @param source manually specify the source for this fetch. Will not cache
 */
export async function fetchISSLocation(
  year: number,
  month: number,
  date: number,
  forceRetriever?: boolean,
  source?: string
): Promise<WrappedResponse<EphemerisStore>> {
  const now = new Date();
  const dateObj = new Date(Date.UTC(year, month - 1, date));
  const isToday = isSameDate(now, dateObj);

  const retrieverCelestrak = async (): Promise<EphemerisStore> => {
    const celestrakResult = await fetchCelestrakToday();
    if (celestrakResult) {
      return { ephemera: [celestrakResult] };
    }
  };

  const retrieverSpacetrack = async (): Promise<EphemerisStore> => {
    // Keep hitting spacetrack going back one day per call until we get some results

    let dateToGet = new Date(Date.UTC(year, month - 1, date));
    let count = 0;
    let numResults = 0;
    let spacetrackResults: EphemerisFile[] = [];

    while (numResults === 0 && count < 10) {
      spacetrackResults = await fetchSpacetrack(
        dateToGet.getFullYear(),
        dateToGet.getUTCMonth() + 1,
        dateToGet.getDate()
      );

      numResults = spacetrackResults.length;
      if (numResults === 0) {
        //subtract 1 day from dateToGet if we didn't get any results
        dateToGet = new Date(dateToGet.getTime() - ONE_DAY_MS);

        // pause 5 seconds before hitting spacetrack again
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      count++;
    }
    const ephemera: EphemerisFile[] = spacetrackResults.map((result) => {
      return {
        EPOCH: result.EPOCH,
        TLE_LINE0: result.TLE_LINE0,
        TLE_LINE1: result.TLE_LINE1,
        TLE_LINE2: result.TLE_LINE2,
      };
    });

    return { ephemera: ephemera };
  };

  let spacetrackRes: WrappedResponse<EphemerisStore> = null;
  let celestrakRes: WrappedResponse<EphemerisStore> = null;

  const identifier = isToday ? "today" : `${year}-${padZeros(month, 2)}-${padZeros(date, 2)}`;

  // check if request wanted a custom source. Do not cache. Also used in fetchDayNight's retrieverIssLocation in order to bypass cache
  if (source === "spacetrack") {
    const spacetrackRes = await retrieverSpacetrack();
    return {
      responseMetadata: null,
      data: spacetrackRes,
      source: "spacetrack",
    };
  } else if (source === "celestrak") {
    if (isToday) {
      const celestrackRes = await retrieverCelestrak();
      return {
        responseMetadata: null,
        data: celestrackRes,
        source: "celestrak",
      };
    } else {
      return {
        data: null,
        responseMetadata: {
          retrieverStatus: "complete",
          error: "Celestrak can only be queried for today's date",
          cachedTimestamp: null,
          expiration: null,
          retrieverErrorCount: 0,
          lastErrorTimestamp: null,
        },
      };
    }
  } else if (source) {
    return {
      data: null,
      responseMetadata: {
        retrieverStatus: "complete",
        error: "Unrecognized source",
        cachedTimestamp: null,
        expiration: null,
        retrieverErrorCount: 0,
        lastErrorTimestamp: null,
      },
    };
  }

  if (isToday) {
    // if today, first try to get TLE data from celestrak, cache only for 5 minutes

    celestrakRes = await fetchWithCache<EphemerisStore>({
      identifier,
      cacheFolder: CacheFolder.Celestrak,
      retriever: retrieverCelestrak,
      cacheAge: 300,
      forceRetriever,
    });
    celestrakRes = { ...celestrakRes, source: "celestrak" };

    //check response from celestrak
    if (celestrakRes.responseMetadata.error) {
      console.error(celestrakRes.responseMetadata.error);
    } else if (celestrakRes.data?.ephemera.length > 0) {
      return celestrakRes; //got data from celestrak!
    }
  }

  // if celestrak didn't work, or if it's not today, try to get data from spacetrack
  spacetrackRes = await fetchWithCache<EphemerisStore>({
    identifier,
    cacheFolder: CacheFolder.Spacetrack,
    retriever: retrieverSpacetrack,
    cacheAge: isToday ? 300 : oneYearInSeconds,
    forceRetriever,
  });
  spacetrackRes = { ...spacetrackRes, source: "spacetrack" };

  return spacetrackRes;
}
