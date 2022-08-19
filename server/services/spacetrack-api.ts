/**
 * Use space-track.org to find the location of ISS at any point in time
 * See https://www.space-track.org/documentation
 */
import { getAppropriateTLE } from "store/ephemera";
import { isSameDate } from "store/playhead";
import { hhmmssFromSeconds, padZeros } from "utils/formatting";
import { getTimes } from "utils/suncalc";
import fetchWithCache from "./cache-client";

import { getSatelliteInfo } from "tle.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SPACETRACK_LOGIN = "https://www.space-track.org/ajaxauth/login";

async function fetchSpacetrack(
  year: number,
  month: number,
  date: number
): Promise<EphemerisFile[]> {
  const isLocal = process.env.NEXT_PUBLIC_APP_ENV === "local";

  if (isLocal) {
    console.log("Mocking request for fetchSpacetrack()");
    let mockSpacetrackData: EphemerisFile[] = require("/mocks/fakedata/ephemera.json");

    // mock the request with local data
    const mockResult = await Promise.resolve(mockSpacetrackData);
    return mockResult;
  }

  const dateParam = `${padZeros(year, 2)}-${padZeros(month, 2)}-${padZeros(date, 2)}`;
  const queryURL = `https://www.space-track.org/basicspacedata/query/class/tle/NORAD_CAT_ID/25544/EPOCH/>${dateParam}%2000:00:00,<${dateParam}%2023:59:59/orderby/EPOCH%20desc/limit/100/emptyresult/show`;
  const body = `identity=${process.env.SPACETRACK_USER}&password=${process.env.SPACETRACK_PASSWORD}&query=${queryURL}`;

  try {
    const res = await fetch(SPACETRACK_LOGIN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    return await res.json();
  } catch (e) {
    console.error(e);
  }
  return [];
}

function calcDayNight(
  ephemera: EphemerisFile[],
  year: number,
  month: number,
  date: number
): DayNightObj[] {
  const secondsIn24Hours = 86400;
  const startDate = new Date(Date.UTC(year, month - 1, date));

  const dayNightObjArray = [];
  let prevDaylight = null;
  //5 seconds resolution on day/night times
  for (let i = 0; i < secondsIn24Hours; i = i + 5) {
    const iISODate = startDate.toISOString().split("T")[0] + "T" + hhmmssFromSeconds(i) + "Z";
    const iDate = new Date(iISODate);
    const tle = getAppropriateTLE(ephemera, iDate.toISOString());
    const issInfo = getSatelliteInfo(tle, iDate.getTime());

    let daylight = true;
    daylight = isSunlit(iDate, issInfo.lng, issInfo.lat, issInfo.height * 1000);

    if (daylight !== prevDaylight) {
      const dayNightObj: DayNightObj = {
        appSeconds: i,
        daylight: daylight,
      };
      dayNightObjArray.push(dayNightObj);
    }

    prevDaylight = daylight;
  }
  const dayNightObj: DayNightObj = {
    appSeconds: secondsIn24Hours,
    daylight: false,
  };
  dayNightObjArray.push(dayNightObj);

  return dayNightObjArray;
}

function isSunlit(date: Date, lng: number, lat: number, heightMeters: number) {
  const sunTimes = getTimes(date, lat, lng, heightMeters);

  // get time between sunset start and golden hour.
  let sunlightEnd = new Date((sunTimes.sunset.getTime() + sunTimes.goldenHour.getTime()) / 2);

  let sunlight = true;
  // if sunrise or sunset are NaN then it's high beta angle season and the sun never sets
  if (!isNaN(sunTimes.sunriseEnd.getTime()) && !isNaN(sunlightEnd.getTime())) {
    if (date > sunTimes.sunriseEnd && date < sunlightEnd) {
      sunlight = true;
    } else {
      sunlight = false;
    }
  }
  return sunlight;
}

/**
 * Get spacetrack ephemeris data for ISS. If the request is for today, get new data. If the request is for a day in the past, always return cached data if we have it
 * @param year yyyy
 * @param month 1-indexed, eg. `1` for Jan, `2` for Feb, etc.
 * @param date day of the month
 */
export async function fetchISSLocation(
  year: number,
  month: number,
  date: number
): Promise<WrappedResponse<EphemerisStore>> {
  const now = new Date();
  const dateObj = new Date(Date.UTC(year, month - 1, date));
  const isToday = isSameDate(now, dateObj);

  let res: WrappedResponse<EphemerisStore> = {
    cacheMetadata: null,
    data: { ephemera: [], dayNight: [] },
  };

  const retriever = async (): Promise<EphemerisStore> => {
    // Keep hitting spacetrack going back one day per call until we get some results

    let dateToGet = new Date(Date.UTC(year, month - 1, date));
    let count = 0;
    let numResults = 0;
    let ephemera: EphemerisFile[] = [];

    while (numResults === 0 && count < 10) {
      ephemera = await fetchSpacetrack(
        dateToGet.getFullYear(),
        dateToGet.getUTCMonth(),
        dateToGet.getDate()
      );

      numResults = ephemera.length;
      if (numResults === 0) {
        //subtract 1 day from dateToGet if we didn't get any results
        dateToGet = new Date(dateToGet.getTime() - ONE_DAY_MS);

        // pause 5 seconds before hitting spacetrack again
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    let dayNight: DayNightObj[] = [];
    if (ephemera.length > 0) {
      dayNight = calcDayNight(ephemera, year, month, date);
    }
    return { ephemera, dayNight };
  };

  const identifier = isToday
    ? "today"
    : `isslocation-${year}-${padZeros(month, 2)}-${padZeros(date, 2)}`;

  try {
    res = await fetchWithCache<EphemerisStore>(`spacetrack/${identifier}`, retriever, {
      preferNew: isToday,
      cacheAge: isToday ? 60 : Infinity,
      staleOk: true,
    });
  } catch (e) {
    // something went wrong that really shouldn't have
    throw e;
  }

  return res;
}
