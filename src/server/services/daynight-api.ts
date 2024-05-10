import { isSameDate, midnightZulu, mmddyy } from "store/playhead";
import fetchWithCache from "./cache-client";
import { hhmmssFromSeconds, padZeros } from "utils/formatting";
import { getAppropriateTLE } from "store/ephemera";
import { getTimes } from "utils/suncalc";
import { getSatelliteInfo } from "tle.js";
import { fetchISSLocation } from "./ephemera-api";
import { get as ntlmGET } from "@evamss/ntlm";
import { CacheFolder } from "utils/enums";

type TopoState = "outOfRange_historic" | "historic" | "predicted" | "outOfRange_predicted";

type TopoURL = {
  state: TopoState;
  url: string;
};

/**
 * Get day night data.
 * @param year yyyy
 * @param month 1-indexed, eg. `1` for Jan, `2` for Feb, etc.
 * @param date day of the month
 * @param forceRetriever Return the cached data, then force the retriever function to get new data regardless of cache age.
 * @param dayNightSource manually specify the data source for this fetch. Will not cache
 * @returns wrapped response of daynight objects
 */
export async function fetchDayNight(
  year: number,
  month: number,
  date: number,
  forceRetriever?: boolean,
  dayNightSource?: string
): Promise<WrappedResponse<DayNightStore>> {
  /** Get data from topo for a single day.
   *  To do this, we need to query multiple files covering current week, week before, week after to ensure we get the requested date.
   *  Each raw week pulled from topo by attempting to retrieve a file for every day of the week starting on Tuesday
   *    (Tuesday is the day of the week the file is supposed to be uploaded.)
   *  All the file data is aggregated and parsed down to find the requested day.
   *  Then formatted into day/night and cached.
   */
  const retrieverTopo = async (): Promise<DayNightStore> => {
    let dayNight: DayNightObj[] = [];
    let topoFileData: string[] = [];

    try {
      for (let i = -1; i < 2; i++) {
        //generate the 3 dates for querying before/current/after weeks
        let queryDate = new Date(
          Date.UTC(
            requestDate.getUTCFullYear(),
            requestDate.getUTCMonth(),
            requestDate.getUTCDate() + i * 7
          )
        );

        //set query date to the previous Tuesday
        let tuesDelta = queryDate.getUTCDay() - 2;
        if (tuesDelta < 0) tuesDelta += 7;
        queryDate.setUTCDate(queryDate.getUTCDate() - tuesDelta);

        let topoData = null;
        for (let tries = 7; tries > 0; tries--) {
          //try every day of the week.
          //This loop should normally run once because files are normally dropped on Tuesday.
          let topoURL = getTopoURL(queryDate);
          if (topoURL.state === "outOfRange_historic" || topoURL.state === "outOfRange_predicted") {
            queryDate.setUTCDate(queryDate.getUTCDate() + 1);
            continue;
          }
          const response: { statusCode: number; body: string } = await new Promise(
            (resolve, reject) => {
              ntlmGET(
                {
                  url: topoURL.url,
                  username: process.env.TOPO_USER,
                  password: process.env.TOPO_PASSWORD,
                  workstation: "any.workstation",
                  domain: "",
                },
                function (err, res) {
                  if (err) {
                    return reject(err);
                  }
                  resolve(res);
                }
              );
            }
          );

          //server will auth first before checking if data exists
          if (response.statusCode === 200) {
            //response from type 3 message is a stream containing all the topo data.
            const streamChunks = [];
            for await (const chunk of response.body) {
              streamChunks.push(Buffer.from(chunk));
            }

            //raw data pulled from topo
            topoData = Buffer.concat(streamChunks).toString("utf-8");

            break; //got a success response. we have our data for this week. do not check additional days.
          } else {
            if (response.statusCode === 404) {
              //file not found. Try the next day day
              queryDate.setUTCDate(queryDate.getUTCDate() + 1);
              continue;
            } else {
              //something else went wrong.
              throw new Error(
                "Something went wrong fetching TOPO data. Response status " +
                  response.statusCode +
                  " for URL " +
                  topoURL.url
              );
            }
          }
        }
        topoFileData.push(topoData);
      }

      // got all the raw week files. process and parse responses
      dayNight = parseTopoData(topoFileData, requestDate);
    } catch (e) {
      console.log("Caught error in retrieverTopoDay: " + e);
      throw e;
    }
    return { dayNight };
  };

  /** Get data using the service fetchISSLocation.
   * Calculate Day/Night from ephemera (this is what get's cached)
   *
   * Return a wrapped response in order to pass along source value returned from fetchISSLocation (spacetrack or celestrack)
   */
  const retrieverIssLocationDayNight = async (): Promise<DayNightStore> => {
    try {
      const now = new Date();
      const dateObj = new Date(Date.UTC(year, month - 1, date));
      const isToday = isSameDate(now, dateObj);
      // specify the source in order to bypass caching and get direct resposnes
      const issLocation: WrappedResponse<EphemerisStore> = await fetchISSLocation(
        year,
        month,
        date,
        false,
        isToday ? "celestrak" : "spacetrack"
      );

      let dayNight: DayNightStore = null;

      // calculate day night based off ephemera if we have data
      if (issLocation.data?.ephemera) {
        let ephemera = issLocation.data.ephemera;
        if (ephemera.length > 0) {
          dayNight = { dayNight: calcDayNight(ephemera, year, month, date) };
        }
      }

      return dayNight;
    } catch (e) {
      console.log("Caught error in retrieverIssLocation: " + e);
      throw e;
    }
  };

  //init variables
  const requestDate = new Date(Date.UTC(year, month - 1, date)); //requested date in UTC
  let res: WrappedResponse<DayNightStore> = {
    responseMetadata: null,
    data: { dayNight: [] },
  };
  const todayMidnight = new Date(Date.now()).setUTCHours(0, 0, 0, 0); //today at midnight
  const twoWeeksAgo = todayMidnight - 1209600000; //60*60*24*14*1000 = ms UTC two weeks ago
  const isHistoric = requestDate.getTime() < todayMidnight;
  const oneYearInSeconds = 31536000;
  let identifier = `${year}-${padZeros(month, 2)}-${padZeros(date, 2)}`;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const tomorrowMidnight = new Date(Date.now() + ONE_DAY_MS).setUTCHours(0, 0, 0, 0);

  //first check if it's too far in the future
  let topoState = getTopoState(requestDate);
  if (topoState === "outOfRange_predicted") {
    return {
      ...res,
      responseMetadata: {
        retrieverStatus: null,
        error: "Requested date is too far in the future",
        cachedTimestamp: null,
        expiration: null,
        retrieverErrorCount: 0,
        lastErrorTimestamp: null,
      },
    };
  } //date requested is too far in the future. No data available

  //check if request wanted a custom source. Do not cache.
  if (dayNightSource === "topo") {
    if (topoState === "outOfRange_historic") {
      return {
        ...res,
        responseMetadata: {
          retrieverStatus: null,
          error: "Requested date is too far in the past for this data source",
          cachedTimestamp: null,
          expiration: null,
          retrieverErrorCount: 0,
          lastErrorTimestamp: null,
        },
      };
    }
    const dayNight = await retrieverTopo();
    return {
      responseMetadata: null,
      data: dayNight,
      source: "topo",
    };
  } else if (dayNightSource === "spacetrack" || dayNightSource === "celestrak") {
    if (requestDate.getTime() > tomorrowMidnight) {
      return {
        responseMetadata: {
          retrieverStatus: null,
          error: "Requested date is too far in the future for this data source.",
          cachedTimestamp: null,
          expiration: null,
          retrieverErrorCount: 0,
          lastErrorTimestamp: null,
        },
        data: { dayNight: [] },
      };
    }
    const issLocDayNight = await retrieverIssLocationDayNight();
    return {
      responseMetadata: null,
      data: issLocDayNight,
      source: "spacetrack_celestrak",
    };
  } else if (dayNightSource) {
    //unrecognized source
    return {
      ...res,
      responseMetadata: {
        retrieverStatus: null,
        error: "Unrecognized source",
        cachedTimestamp: null,
        expiration: null,
        retrieverErrorCount: 0,
        lastErrorTimestamp: null,
      },
    };
  }

  /**
   * Determine cache age for topo
   *   if today and future, cache for 1 week (the schedule that topo predicted data is released)
   *   if in the last 2 weeks, cache for 24 hours incase topo data is missing.
   *      we are accepting the risk that if topo data *is* available, it will be short-cached until 2 weeks past
   *   if older than 2 weeks, cache for a year
   * */
  let cacheAge_topo = oneYearInSeconds;
  if (!isHistoric) {
    cacheAge_topo = 604800; //60*60*24*7 = 1 week in seconds
  } else if (requestDate.getTime() >= twoWeeksAgo) {
    cacheAge_topo = 86400; //60*60*24 = 1 day in seconds
  }

  //fetch topo. we're in a valid date range for topo. this is the prefered method.
  if (topoState !== "outOfRange_historic") {
    res = await fetchWithCache<DayNightStore>({
      identifier,
      cacheFolder: CacheFolder.Daynight_topo,
      retriever: retrieverTopo,
      cacheAge: cacheAge_topo,
      forceRetriever,
    });
    res.source = "topo";

    //check topo response.
    if (res.responseMetadata.error) {
      console.error("TOPO fetch with cache returned an error: " + res.responseMetadata.error);
    } else {
      return res;
    }
  }

  // topo failed or in progress, check if requested date is after tomorrow midnight, don't fall back to spacetrack
  if (requestDate.getTime() > tomorrowMidnight) {
    return {
      ...res,
      responseMetadata: {
        ...res.responseMetadata,
        error: `${
          res.responseMetadata.error ? res.responseMetadata.error + ". " : ""
        }Unable to failover to ISS Location because requested date is too far in the future.`,
      },
    };
  }

  // topo either returned bad/no data, or date requested is too far in the past for topo. move on...
  // fetch iss location.

  /**
   * Determine cache age for spacetrack
   *   if today or if we are here becuase topo failed, cache for 5 minutes
   *   otherwise we are in the past, cache for 1 year
   * */
  let cacheAge_spacetrack = oneYearInSeconds;
  if (!isHistoric || topoState !== "outOfRange_historic") {
    cacheAge_spacetrack = 300; // 5 minutes
  }

  res = await fetchWithCache<DayNightStore>({
    identifier,
    cacheFolder: CacheFolder.Daynight_issLocation,
    retriever: retrieverIssLocationDayNight,
    cacheAge: cacheAge_spacetrack,
    forceRetriever,
  });
  res.source = "spacetrack_celestrak";

  return res;
}

/**
 * Takes in an array of fetch responses each containing raw topo week data and parses them into a daynight array.
 * @param topoFileData array of Response objects from topo
 * @param requestDate the date to look for in the responses
 * @returns a parsed array of the day night values for the given requestDate
 */
function parseTopoData(topoFileData: string[], requestDate: Date): DayNightObj[] {
  let dayNightArr: DayNightObj[] = [];
  let foundSTPfile = false; //is short term plan (stp) predicted file

  //loop through responses
  for (let i = 0; i < topoFileData.length; i++) {
    if (!topoFileData[i]) {
      continue; //check next file
    }

    //read the file
    const lines = topoFileData[i].split("\n"); //split every line up

    //check if this is a predcited (stp) file. We only want to read this kind of file one time.
    //  These files contain full days so the requested date will not be split between 2 files (unlike bet historic data).
    //  However multiple responses may come back with the precited file and the requested date could be present more than once.
    //  We only want to push 1 copy to the day/night array. Ex. requested date is multiple weeks in the future.
    if (lines[0] === "topo52.ISS.sun_lighting_events.ascii") {
      if (foundSTPfile) {
        continue; //this is the 2nd time we've hit an stp file. Skip and go to the next file
      } else {
        foundSTPfile = true;
      }
    }

    //loop through lines in the file
    for (let j = 0; j < lines.length; j++) {
      //check valid line
      if (isNaN(parseInt(lines[j].trim().charAt(0)))) {
        continue; //this line doesn't start with a number. probably a header or footer line. skip it.
      }

      //reduce multiple spaces to single space, then split the line to get columns
      const regEx: RegExp = /\s+/g;
      const columns = lines[j].trim().replaceAll(regEx, " ").split(" ");

      //check date (0th column)
      const [year, month, day, hour, min, sec] = columns[0].split(":").map(Number); //split on : and convert from string to numbers
      if (!isSameDate(requestDate, new Date(Date.UTC(year, month - 1, day)))) {
        continue; //date doesn't match the day we're looking for. Move to next line.
      }

      //check sun acquisition (9th column)
      let sunState: SunLighting = getSunLighting(columns[9]);
      if (!sunState) continue; //this is a sun acquisiton state we don't track. Move to next line.

      //date and sun acquisiton are valid!
      //calcuate app seconds and add to daynight array
      const appSecs = hour * 3600 + min * 60 + Math.round(sec); //convert hour minutes seconds to just total seconds
      dayNightArr.push({
        appSeconds: appSecs,
        daylight: sunState,
      } as DayNightObj);
    }
  }

  /**
   * Check if we have at least one entry in the morning and one in the evening.
   * If we don't, then this may indicate we have partial data.
   * Partial data may occur when a bet data ends on half day, and remaining half is not released yet.
   * If we are in high beta angle season, this will also trigger
   * Returning blank array will trigger a call to use iss location as the fall back
   * */
  let appSecCheck = { morning: false, evening: false };
  for (let dayNight of dayNightArr) {
    //60*60*24 = 86400 app seconds in a day.  43200 is half day mark.
    if (dayNight.appSeconds < 43200) appSecCheck.morning = true;
    if (dayNight.appSeconds >= 43200) appSecCheck.evening = true;
  }
  if (!appSecCheck.morning || !appSecCheck.evening) return [];

  //add first and last entries of the 24 hour period
  if (dayNightArr[0].appSeconds !== 0) {
    switch (dayNightArr[0].daylight) {
      case "day":
        dayNightArr.unshift({ appSeconds: 0, daylight: "sunrise" });
        break;
      case "night":
        dayNightArr.unshift({ appSeconds: 0, daylight: "sunset" });
        break;
      case "sunrise":
        dayNightArr.unshift({ appSeconds: 0, daylight: "night" });
        break;
      case "sunset":
        dayNightArr.unshift({ appSeconds: 0, daylight: "day" });
        break;
      default:
        const exhaustiveCheck: never = dayNightArr[0].daylight;
        throw new Error("never-check reached on sunLighting value: " + exhaustiveCheck);
    }
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
  const topoState: TopoState = getTopoState(requestDate);
  let topoURL: TopoURL = { url: "", state: topoState };

  if (topoState === "outOfRange_predicted" || topoState === "outOfRange_historic") {
    //date is too far in the future or too far in the past. No data is available
    topoURL.url = null;
    return topoURL;
  } else if (topoState === "predicted") {
    //use stp (short term plan) predicted data . Requested date is between today at midnight zulu and 50 days
    topoURL.url = "https://fod2.jsc.nasa.gov/CM/TOPO/data/stp/topo52.ISS.sun_lighting_events.txt";
  } else if (topoState === "historic") {
    //historic data. Use best estimated trajectory data (bet). Build filename
    const extChange = new Date(Date.UTC(2015, 0, 5)); //date when BET file naming extension changed
    let ext = requestDate.getTime() < extChange.getTime() ? ".cff.txt" : ".cff.conv.txt";

    topoURL.url =
      "https://fod2.jsc.nasa.gov/CM/TOPO/data/bet/Sun%20Lighting%20Data/As%20Flown/" +
      requestDate.getUTCFullYear() +
      "/bet_data1_" +
      mmddyy(requestDate) +
      ".ISS.sun_lighting_events" +
      ext;
  }
  return topoURL;
}

/**
 * Determines what state the topo data is in for a given date.
 * As long as the state returned is not "outOfRange_" then data will be available on the topo server
 * @param requestDate the date to check
 * @returns the state of the data will be in when it is retrieved from the topo server
 */
export function getTopoState(requestDate: Date): TopoState {
  const historicMin = new Date(Date.UTC(2013, 2, 31)); //cutoff day for pulling TOPO. Around this time TOPO also changed from 2x week data dumps to 1x week.
  const now = midnightZulu(new Date()); //curent date with time to 0 UTC

  //advance today by 50 days (not 49, use midnight UTC on the 50th day)
  const futureMax = new Date(now.getTime());
  futureMax.setUTCDate(now.getUTCDate() + 50);

  if (requestDate.getTime() >= futureMax.getTime()) {
    //date is too far in the future.
    return "outOfRange_predicted";
  } else if (
    requestDate.getTime() >= midnightZulu(now).getTime() &&
    requestDate.getTime() < futureMax.getTime()
  ) {
    //Requested date is between today at midnight zulu and 50 days
    //Use predicted datasource if requested date is today and 7 weeks forward.
    //Don't pull the 8th week to account for potential lag in update
    return "predicted";
  } else if (requestDate.getTime() >= historicMin.getTime()) {
    //historic data.
    return "historic";
  } else {
    //date is too far in the past.
    return "outOfRange_historic";
  }
}

/**
 * Translates the sun acquisition flags from the topo raw data to the SunLighting type for day/night
 * @param sunAcquisition string representing a sun acquisiton state from topo
 * @returns the SunLighting value for day night
 */
function getSunLighting(sunAcquisition: string): SunLighting {
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
      return null; //this is a sun acquisiton state we don't track.
  }
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
