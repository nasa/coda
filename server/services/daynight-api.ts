import { isSameDate, midnightZulu, mmddyy } from "store/playhead";
import fetchWithCache from "./cache-client";
import { hhmmssFromSeconds, padZeros } from "utils/formatting";
import { getAppropriateTLE } from "store/ephemera";
import { getTimes } from "utils/suncalc";
import { getSatelliteInfo } from "tle.js";
import { fetchISSLocation } from "./ephemera-api";
import { weekNumberSun } from "weeknumber";
import fetchWithTimeout from "utils/fetch-with-timeout";
import type { Response } from "node-fetch";

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
  /** Get data from topo for a single day.
   *  To do this, we need to query multiple files covering current week, week before, week after to ensure we get the requested date.
   *  Each file pulled from topo is also cached
   *  All the file data is aggregated and parsed down to find the requested day. Then formatted into day/night.
   */
  const retrieverTopoDay = async (): Promise<DayNightStore> => {
    let dayNight: DayNightObj[] = [];

    let topoResArray: WrappedResponse<string>[] = [];
    try {
      for (let i = -1; i < 2; i++) {
        let queryDate = new Date(
          Date.UTC(
            requestDate.getUTCFullYear(),
            requestDate.getUTCMonth(),
            requestDate.getUTCDate() + i * 7
          )
        );
        let identifier: string = requestDate.getUTCFullYear() + "-" + weekNumberSun(queryDate);
        let topoRes: WrappedResponse<string> = {
          cacheMetadata: null,
          data: "",
        };
        //topo raw data is cached using a week number identifier
        topoRes = await fetchWithCache<string>(
          `daynight/topo/${identifier}`,
          function () {
            return retrieverTopo(queryDate);
          },
          {
            preferNew: isToday,
            cacheAge: isToday ? 60 : oneYearInSeconds,
            staleOk: true,
          }
        );
        topoResArray.push(topoRes); //push responses for each week into an array for processing
      }
    } catch (e) {
      throw e;
    }

    //process and parse responses
    dayNight = parseTopoData(topoResArray);

    return { dayNight };
  };

  /** Get data file for a given week from TOPO.
   *  Try fetching a file name for every day of the week starting on Tuesday
   *  (Tuesday is the day of the week the file is supposed to be uploaded)
   * @param queryDate a day during the week from which we need to get TOPO data
   * @returns raw topo file data
   */
  const retrieverTopo = async (queryDate: Date): Promise<string> => {
    const options = {
      timeout: 8000,
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
        "Accept-Encoding": "gzip,deflate,br",
        "Accept-Language": "en-US,en;q=0.9",
        Connection: "keep-alive",
        Origin: process.env.HOST,
      },
    };

    let res: Response;
    //set query date to the previous Tuesday
    const tuesDelta = (queryDate.getUTCDay() - 5) % 7;
    queryDate.setUTCDate(queryDate.getUTCDate() - tuesDelta);

    try {
      for (let tries = 7; tries > 0; tries--) {
        let queryUrl = getTopoURL(queryDate); //build topo URL for this date
        if (!queryUrl) {
          //A null or blank means querydate it's outside topo range. Try the next day
          queryDate.setUTCDate(queryDate.getUTCDate() + 1);
          continue;
        }

        res = await fetchWithTimeout(queryUrl, options);
        if (res.status === 200) {
          break; //got a success response. yay!
        } else {
          if (res.status === 404) {
            //file not found. Try the next day day
            queryDate.setUTCDate(queryDate.getUTCDate() + 1);
            continue;
          } else {
            //something else went wrong.
            throw new Error(
              "Something went wrong fetching TOPO data. Response status " +
                res.status +
                " for URL " +
                queryUrl
            );
          }
        }
      }
    } catch (e) {
      throw e;
    }

    //TODO what does this return on an empty response?
    return res.json();
  };

  /** Get data from spacetrack
   * If the ephemera data was already retrieved earlier during the iss location fetch, then the cache is returned.
   * Vice versa for location if this day night fetch executes before the location fetch.
   * Essentially only one call to space-track.org will ultimately occur.
   */
  const retrieverSpacetrack = async (): Promise<DayNightStore> => {
    let dayNight: DayNightObj[] = [];

    let spacetrack: WrappedResponse<EphemerisStore> = await fetchISSLocation(year, month, date);
    let ephemera = spacetrack.data.ephemera;

    //calculate day night based off ephemera
    if (ephemera.length > 0) {
      dayNight = calcDayNight(ephemera, year, month, date);
    }

    return { dayNight };
  };

  const requestDate = new Date(Date.UTC(year, month - 1, date)); //requested date in UTC
  let res: WrappedResponse<DayNightStore> = {
    cacheMetadata: null,
    data: { dayNight: [] },
  };
  let requestUrl = getTopoURL(requestDate);
  if (requestUrl === null) return res; //date requested is too far in the future. No data available

  const isToday = isSameDate(new Date(), requestDate);
  const oneYearInSeconds = 31536000;
  let identifier = `${year}-${padZeros(month, 2)}-${padZeros(date, 2)}`;

  //fetch topo.
  //this is the prefered method. If this fails for any reason, fallback is spacetrack
  try {
    if (requestUrl !== "") {
      res = await fetchWithCache<DayNightStore>(`daynight/${identifier}`, retrieverTopoDay, {
        preferNew: isToday,
        cacheAge: isToday ? 60 : oneYearInSeconds,
        staleOk: true,
      });
    }
  } catch (e) {
    // something went wrong
    throw e;
  }

  //TODO check error?
  if (res.cacheMetadata.error) {
  } else {
    return res;
  }

  //fetch spacetrack.
  //either topo returned bad data or date requested is too far in the past for topo.
  try {
    res = await fetchWithCache<DayNightStore>(`daynight/${identifier}`, retrieverSpacetrack, {
      preferNew: isToday,
      cacheAge: isToday ? 60 : oneYearInSeconds,
      staleOk: true,
    });
  } catch (e) {
    // something went wrong
    throw e;
  }

  return res;
}

/**
 * Takes in an array of fetch Responses and parses them into a daynight array
 * @param resArray array of Response objects from topo
 * @returns a parsed array of the day night values
 */
function parseTopoData(resArray: WrappedResponse<string>[]): DayNightObj[] {
  let dayNight: DayNightObj[] = [];

  //check valid responses
  if (resArray[0].cacheMetadata.error) {
    //fetch returned an error
  }

  //grab all the data
  if (resArray[0].data) {
    //we have data
  } else {
    //data option not exist    (should have been caught on the cachemetadata.error test)
    //or it exists but is null meaning the request spilled over topo boundries
  }

  //check that requested date is in one of the responses.

  //parse into day/night

  //console.log(resArray);
  return dayNight;
}

/**
 * Determines what TOPO url to use
 * Use predicted datasource if requested date is today and 7 weeks forward.
 * Don't pull the 8th week to account for potential lag in update
 * @param date UTC
 * @returns URL of the file to fetch.
 *          Null if date is too far in the future and there is no data.
 *          Empty string if date is too far in the past. Use Spacetrack in this instance
 */
export function getTopoURL(requestDate: Date): string {
  const now = midnightZulu(new Date()); //curent date with time to 0 UTC
  const futureMax = new Date(now.getTime()); //copy date
  futureMax.setUTCDate(now.getUTCDate() + 50); //advance today by 50 days (not 49, use midnight UTC on the 50th day)
  const historicMin = new Date(Date.UTC(2013, 2, 31)); //cutoff day for pulling TOPO. Around this time TOPO also changed from 2x week data dumps to 1x week.

  let topoURL = "";
  if (requestDate.getTime() >= futureMax.getTime()) {
    return null; //date is too far in the future. No data is available
  } else if (
    requestDate.getTime() >= midnightZulu(now).getTime() &&
    requestDate.getTime() < futureMax.getTime()
  ) {
    //use predicted data. Requested date is between today at midnight zulu and 50 days
    topoURL = "https://fod2.jsc.nasa.gov/CM/TOPO/data/stp/topo52.ISS.sun_lighting_events.txt";
  } else if (requestDate.getTime() >= historicMin.getTime()) {
    //historic data. Use best estimated trajectory data (bet). Build filename
    topoURL =
      "https://fod2.jsc.nasa.gov/CM/TOPO/data/bet/Sun%20Lighting%20Data/As%20Flown/" +
      requestDate.getUTCFullYear() +
      "/bet_data1_" +
      mmddyy(requestDate) +
      ".ISS.sun_lighting_events.cff.conv.txt";
  }
  return topoURL;
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
