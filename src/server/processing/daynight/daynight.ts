import * as DayNightService from "server/services/daynight-api";

export default async function getDayNight({
  dateWanted,
  dayNightSource = undefined,
}: {
  dateWanted: string;
  dayNightSource?: string;
}): Promise<FetchResponse<DayNightStore>> {
  const [year, month, date] = dateWanted.split("-").map((x) => parseInt(x, 10));
  return await DayNightService.fetchDayNight(year, month, date, dayNightSource);
}
