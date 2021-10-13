import type { WrappedResponse } from "typings";
import type { EphemerisStore } from "typings/spacetrack";

export async function buildEphemerisStore(
  year: number,
  month: number,
  date: number
): Promise<EphemerisStore> {
  const res = await fetch(`/api/location/iss?year=${year}&month=${month}&date=${date}`);
  const wrappedResponse: WrappedResponse<EphemerisStore> = await res.json();
  return wrappedResponse.data;
}
