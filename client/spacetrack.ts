import type { WrappedResponse } from "typings";
import type { EphemerisStore } from "typings/spacetrack";

async function fetchSpacetrack(
  year: number,
  month: number,
  date: number
): Promise<WrappedResponse<EphemerisStore>> {
  const res = await fetch(`/api/spacetrack?year=${year}&month=${month}&date=${date}`);
  return res.json();
}

export async function buildEphemerisStore(
  year: number,
  month: number,
  date: number
): Promise<EphemerisStore> {
  const res = await fetchSpacetrack(year, month, date);
  console.log(res);
  return res.data;
}
