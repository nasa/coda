export async function buildDayNightStore(
  year: number,
  month: number,
  date: number
): Promise<WrappedResponse<DayNightStore>> {
  const res = await fetch(`/api/v1/daynight/daynight?year=${year}&month=${month}&date=${date}`);
  const wrappedResponse: WrappedResponse<DayNightStore> = await res.json();
  return wrappedResponse;
}
