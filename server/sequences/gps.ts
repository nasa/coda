import * as WikiService from "server/services/wiki-api";

export default async function getGPSTracks(
  dateWanted: string
): Promise<WrappedResponse<GPSTrack[]>> {
  const results = await WikiService.fetchWikiGPSTracks(dateWanted);
  return results;
}
