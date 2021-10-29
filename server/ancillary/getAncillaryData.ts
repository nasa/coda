import * as AncillaryDataService from "server/services/ancillary-data-svc";

export default async function getAncillaryData(
  dateWanted: string,
  eventType: string
): Promise<any> {
  const results = await AncillaryDataService.fetchAncillaryData(dateWanted, eventType);
  return results;
}
