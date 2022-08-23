/**
 *
 */
import { isSameDate } from "store/playhead";
import fetchWithCache from "./cache-client";
import { hhmmssFromSeconds, padZeros } from "utils/formatting";
import { getAppropriateTLE } from "store/ephemera";
import { getTimes } from "utils/suncalc";
import { getSatelliteInfo } from "tle.js";
import { fetchISSLocation } from "./spacetrack-api";

/**
 * Get day night data.
 * @param year yyyy
 * @param month 1-indexed, eg. `1` for Jan, `2` for Feb, etc.
 * @param date day of the month
 * @returns wrapped response of daynight objects
 */
export async function fetchDayNight(
  year: number,
  month: number,
  date: number
): Promise<WrappedResponse<DayNightStore>> {
  const now = new Date();
  const dateObj = new Date(Date.UTC(year, month - 1, date));
  const isToday = isSameDate(now, dateObj);
  let res: WrappedResponse<DayNightStore> = {
    cacheMetadata: null,
    data: { dayNight: [] },
  };

  const retriever = async (): Promise<DayNightStore> => {
    let dayNight: DayNightObj[] = [];

    /** Get data from spacetrack
     * If the ephemera data was already retrieved earlier during the location fetch, then the cache is returned.
     * Vice versa for location if this day night fetch executes before the location fetch.
     * Essentially only one call to space-track.org will ultimately occur.
     */
    let spacetrack: WrappedResponse<EphemerisStore> = await fetchISSLocation(year, month, date);
    let ephemera = spacetrack.data.ephemera;

    //calculate day night based off ephemera
    if (ephemera.length > 0) {
      dayNight = calcDayNight(ephemera, year, month, date);
    }

    return { dayNight };
  };

  const identifier = isToday ? "today" : `${year}-${padZeros(month, 2)}-${padZeros(date, 2)}`;

  try {
    const oneYearInSeconds = 31536000;
    res = await fetchWithCache<DayNightStore>(`daynight/${identifier}`, retriever, {
      preferNew: isToday,
      cacheAge: isToday ? 60 : oneYearInSeconds,
      staleOk: true,
    });
  } catch (e) {
    // something went wrong that really shouldn't have
    throw e;
  }

  return res;
}

/**
 * Calculate day night information from a given ephemera for a desired date
 * @param ephemera ephemera containing a TLE
 * @param year yyyy
 * @param month mm
 * @param date dd
 * @returns An array of day night objects. Each object in the array is a change in daylight state.
 */
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
        daylight: daylight ? "day" : "night",
      };
      dayNightObjArray.push(dayNightObj);
    }

    prevDaylight = daylight;
  }
  const dayNightObj: DayNightObj = {
    appSeconds: secondsIn24Hours,
    daylight: "night",
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
