import * as WikiService from "server/services/wiki-api";

export default async function getGPSTracks(
  dateWanted: string,
  forceNew: boolean
): Promise<WrappedResponse<GPSTrack[]>> {
  const results = await WikiService.fetchWikiGPSTracks(dateWanted, forceNew);
  return results;
}
