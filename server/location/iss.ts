import { fetchISSLocation } from "services/spacetrack-api";
import type { WrappedResponse } from "typings";
import type { EphemerisStore } from "typings/spacetrack";

export default async function getISSLocation(
  year: number,
  month: number,
  date: number
): Promise<WrappedResponse<EphemerisStore>> {
  return fetchISSLocation(year, month, date);
}
