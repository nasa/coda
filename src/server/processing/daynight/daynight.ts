import * as DayNightService from "server/services/daynight-api";

export default async function getDayNight({
  dateWanted,
  forceNew = false,
  dayNightSource = undefined,
}: {
  dateWanted: string;
  forceNew?: boolean;
  dayNightSource?: string;
}): Promise<WrappedResponse<DayNightStore>> {
  const [year, month, date] = dateWanted.split("-").map((x) => parseInt(x, 10));
  return await DayNightService.fetchDayNight(year, month, date, forceNew, dayNightSource);
}
