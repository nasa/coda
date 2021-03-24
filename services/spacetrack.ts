import fetch from "isomorphic-unfetch";
import { padZeros, hhmmssFromSeconds } from "utils/formatting";
import { getAppropriateTLE } from "store/ephemera";
import { getTimes } from "utils/suncalc";

const { getSatelliteInfo } = require("tle.js/dist/tlejs.cjs");

type EphemerisStore = {
  ephemera: Ephemeris[];
  dayNight: {};
};

export type Ephemeris = {
  COMMENT: string;
  ORIGINATOR: string;
  NORAD_CAT_ID: string;
  OBJECT_NAME: string;
  OBJECT_TYPE: string;
  CLASSIFICATION_TYP: string;
  INTLDES: string;
  EPOCH: string;
  EPOCH_MICROSECONDS: string;
  MEAN_MOTION: string;
  ECCENTRICITY: string;
  INCLINATION: string;
  RA_OF_ASC_NODE: string;
  ARG_OF_PERICENTER: string;
  MEAN_ANOMALY: string;
  EPHEMERIS_TYPE: string;
  ELEMENT_SET_NO: string;
  REV_AT_EPOCH: string;
  BSTAR: string;
  MEAN_MOTION_DOT: string;
  MEAN_MOTION_DDOT: string;
  FILE: string;
  TLE_LINE0: string;
  TLE_LINE1: string;
  TLE_LINE2: string;
  OBJECT_ID: string;
  OBJECT_NUMBER: string;
  SEMIMAJOR_AXIS: string;
  PERIOD: string;
  APOGEE: string;
  PERIGEE: string;
  DECAYED: string;
};

async function fetchSpacetrack(dateStr: string): Promise<Ephemeris[]> {
  const url = process.env.SPACETRACK_API_URL + "?date=" + dateStr;

  let res: Response;

  try {
    res = await fetch(url);
  } catch (e) {
    throw e;
  }
  return res.json();
}

export type DayNightObj = {
  appSeconds: number;
  daylight: boolean;
};

function calcDayNight(ephemera: Ephemeris[], dateStr: string): DayNightObj[] {
  const secondsIn24Hours = 86400;
  const startDate = new Date(dateStr + "T00:00:00Z");

  const dayNightObjArray = [];
  let prevDaylight = null;
  //30 seconds resolution on day/night times
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
  let sunlightEnd = new Date((sunTimes.sunsetStart.getTime() + sunTimes.goldenHour.getTime()) / 2);

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

export async function buildEphemerisStore(
  year: number,
  month: number,
  date: number
): Promise<EphemerisStore> {
  const dateStr = `${year}-${padZeros(month, 2)}-${padZeros(date, 2)}`;
  const ephemera = await fetchSpacetrack(dateStr);
  const dayNight = calcDayNight(ephemera, dateStr);

  return {
    ephemera: ephemera,
    dayNight: dayNight,
  };
}
