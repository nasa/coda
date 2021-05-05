import { getAppropriateTLE } from "store/ephemera";
import { getTimes } from "utils/suncalc";
import type { DayNightObj, EphemerisFile } from "typings/spacetrack";
import { isSameDate } from "store/playhead";
import { hhmmssFromSeconds } from "utils/formatting";
import fetchWithCache from "./cache-client";

const { getSatelliteInfo } = require("tle.js/dist/tlejs.cjs");

const SPACETRACK_LOGIN = "https://www.space-track.org/ajaxauth/login";
const SPACETRACK_BASE =
  "https://www.space-track.org/basicspacedata/query/class/tle/NORAD_CAT_ID/25544/EPOCH/";

async function fetchSpacetrack(dateStr: string): Promise<EphemerisFile[]> {
  const isLocal = process.env.NEXT_PUBLIC_APP_ENV === "local";

  if (isLocal) {
    console.log("Mocking request for fetchSpacetrack()");
    let mockSpacetrackData: EphemerisFile[] = require("../mocks/fakedata/ephemera.json");

    // mock the request with local data
    const mockResult = await Promise.resolve(mockSpacetrackData);
    return mockResult;
  }

  const url = process.env.SPACETRACK_API_URL + "?date=" + dateStr;

  let res: Response;

  try {
    res = await fetch(url);
  } catch (e) {
    throw e;
  }
  return res.json();
}

function calcDayNight(ephemera: EphemerisFile[], dateStr: string): DayNightObj[] {
  const secondsIn24Hours = 86400;
  const startDate = new Date(dateStr + "T00:00:00Z");

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

export async function getISS(year: number, month: number, date: number): Promise<EphemerisFile[]> {
  const now = new Date();
  const preferNew = isSameDate(now, new Date(year, month, date));
  const dateParam = `${year}-${month}-${date}`;

  const queryURL = `${SPACETRACK_BASE}>${dateParam}%2000:00:00,>${dateParam}%2023:59:59/orderby/EPOCH desc/limit/100/emptyresult/show`;

  const retriever = async (): Promise<EphemerisFile[]> => {
    //
  };

  return fetchWithCache<EphemerisFile[]>(`spacetrack/${dateParam}`, retriever, { preferNew });
}
