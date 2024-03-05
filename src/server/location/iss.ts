import * as EphemeraService from "server/services/ephemera-api";

export default async function getISSLocation(
  year: number,
  month: number,
  date: number,
  forceNew: boolean
): Promise<WrappedResponse<EphemerisStore>> {
  return await EphemeraService.fetchISSLocation(year, month, date, forceNew);
}
