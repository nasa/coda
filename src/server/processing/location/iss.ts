import * as EphemeraService from "server/services/ephemera-api";

export default async function getEphemera({
  dateWanted,
}: {
  dateWanted: string;
}): Promise<FetchResponse<EphemerisStore>> {
  const [year, month, date] = dateWanted.split("-").map((x) => parseInt(x, 10));
  return await EphemeraService.fetchISSLocation(year, month, date);
}
