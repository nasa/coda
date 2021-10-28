import * as AncillaryDataService from "server/services/ancillary-data-svc";

export default async function getGPSTracks(dateWanted: string, eventType: string): Promise<any> {
  const results = await AncillaryDataService.fetchGPSTracks(dateWanted, eventType);
  return results;
}
