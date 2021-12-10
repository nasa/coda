import * as SpacetrackService from "server/services/spacetrack-api";

export default async function getISSLocation(
  year: number,
  month: number,
  date: number
): Promise<WrappedResponse<EphemerisStore>> {
  return SpacetrackService.fetchISSLocation(year, month, date);
}
