import * as EphemeraService from "server/services/ephemera-api";
import * as DayNightService from "server/services/daynight-api";

export default async function getISSLocation(
  year: number,
  month: number,
  date: number
): Promise<WrappedResponse<EphemerisStoreWithDayNight>> {
  const dayNight = await DayNightService.fetchDayNight(year, month, date);
  const ephemeris = await EphemeraService.fetchISSLocation(year, month, date);

  // Converting the new day/night data to the old format
  let convertedDayNight: DayNightObjDepricated[] = [];
  dayNight.data.dayNight.forEach((dn) => {
    if (dn.daylight === "day" || dn.daylight === "night") {
      convertedDayNight.push({
        appSeconds: dn.appSeconds,
        daylight: dn.daylight === "day" ? true : false,
      });
    }
  });

  // Custom response that should be removed when dayNight is removed from is API response
  const response: WrappedResponse<EphemerisStoreWithDayNight> = {
    cacheMetadata: {
      fromCache: ephemeris.cacheMetadata.fromCache,
      timestamp: ephemeris.cacheMetadata.timestamp,
      stale: ephemeris.cacheMetadata.stale,
    },
    data: {
      ephemera: ephemeris.data.ephemera,
      dayNight: convertedDayNight,
    },
  };
  if (ephemeris.source) {
    response.source = ephemeris.source;
  }

  return response;
}
