import * as DayNightService from "server/services/daynight-api";

export default async function getDayNight(
  year: number,
  month: number,
  date: number
): Promise<WrappedResponse<DayNightStore>> {
  return await DayNightService.fetchDayNight(year, month, date);
}
