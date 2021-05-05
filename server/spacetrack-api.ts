/**
 * Use space-track.org to find the location of ISS at any point in time
 * See https://www.space-track.org/documentation
 */
import { hhmmssFromSeconds, padZeros } from "utils/formatting";
import { getTimes } from "utils/suncalc";
import { getAppropriateTLE } from "store/ephemera";
import { isSameDate } from "store/playhead";
import fetchWithCache from "./cache-client";
import type { DayNightObj, EphemerisFile, EphemerisStore } from "typings/spacetrack";
import type { WrappedResponse } from "typings";

const { getSatelliteInfo } = require("tle.js/dist/tlejs.cjs");

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
    let mockSpacetrackData: EphemerisFile[] = require("../mocks/fakedata/ephemera.json");

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
  const startDate = new Date(Date.UTC(year, month, date));

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
  const dayNightObj = {
    appSeconds: secondsIn24Hours,
    datlight: false,
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

/** Get spacetrack ephemeris data for ISS */
export async function getISS(
  year: number,
  month: number,
  date: number
): Promise<WrappedResponse<EphemerisStore>> {
  const now = new Date();
  const preferNew = isSameDate(now, new Date(Date.UTC(year, month - 1, date)));

  let res: WrappedResponse<EphemerisStore> = null;

  // try with the date asked for first
  try {
    const retriever = async (): Promise<EphemerisStore> => {
      const ephemera = await fetchSpacetrack(year, month, date);

      if (ephemera.length === 0) {
        throw new Error(`No data available for '${dateParam}'`);
      }

      const dayNight = calcDayNight(ephemera, year, month, date);
      return { dayNight, ephemera };
    };

    const dateParam = `${padZeros(year, 2)}-${padZeros(month, 2)}-${padZeros(date, 2)}`;
    res = await fetchWithCache<EphemerisStore>(`spacetrack/${dateParam}`, retriever, {
      preferNew,
    });
  } catch (e) {
    // couldn't get a response for today. try yesterday
    try {
      const today = new Date(Date.UTC(year, month - 1, date));
      const yesterday = new Date(today.valueOf() - ONE_DAY_MS);
      const yesterdayYear = yesterday.getUTCFullYear();
      const yesterdayMonth = yesterday.getUTCMonth() + 1;
      const yesterdayDate = yesterday.getUTCDate();
      const dateParam = `${padZeros(yesterdayYear, 2)}-${padZeros(yesterdayMonth, 2)}-${padZeros(
        yesterdayDate,
        2
      )}`;

      const retriever = async (): Promise<EphemerisStore> => {
        const ephemera = await fetchSpacetrack(yesterdayYear, yesterdayMonth, yesterdayDate);

        if (ephemera.length === 0) {
          throw new Error(`No data available for '${dateParam}'`);
        }

        const dayNight = calcDayNight(ephemera, yesterdayYear, yesterdayMonth, yesterdayDate);
        return { dayNight, ephemera };
      };

      res = await fetchWithCache<EphemerisStore>(`spacetrack/${dateParam}`, retriever, {
        preferNew,
      });
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  return res;
}
