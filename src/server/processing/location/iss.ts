import * as EphemeraService from "server/services/ephemera-api";

export default async function getISSLocation(params: {
  dateWanted: string;
  forceNew: boolean;
}): Promise<WrappedResponse<EphemerisStore>> {
  const { dateWanted, forceNew } = params;
  const [year, month, date] = dateWanted.split("-").map((x) => parseInt(x, 10));
  return await EphemeraService.fetchISSLocation(year, month, date, forceNew);
}
