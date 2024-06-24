import { queryStringFromObject } from "utils/formatting";

export async function buildDayNightStore(
  dateWanted: string
): Promise<WrappedResponse<DayNightStore>> {
  const queryParams: DayNightQueryParams = {
    dateWanted,
  };
  const queryString = queryStringFromObject(queryParams);
  const res = await fetch(`/api/v1/daynight/daynight?${queryString}`);
  const wrappedResponse: WrappedResponse<DayNightStore> = await res.json();
  return wrappedResponse;
}
