import * as DayNightService from "server/services/daynight-api";

export default async function getDayNight(params: {
  dateWanted: string;
  forceNew: boolean;
  dayNightSource: string;
}): Promise<WrappedResponse<DayNightStore>> {
  const { dateWanted, forceNew, dayNightSource } = params;
  const [year, month, date] = dateWanted.split("-").map((x) => parseInt(x, 10));
  return await DayNightService.fetchDayNight(year, month, date, forceNew, dayNightSource);
}
