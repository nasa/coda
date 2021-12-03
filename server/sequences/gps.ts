import * as WikiService from "server/services/wiki-api";
import { WrappedResponse } from "typings";
import { GPSTrack } from "typings/gps";

export default async function getGPSTracks(
  dateWanted: string
): Promise<WrappedResponse<GPSTrack[]>> {
  const results = await WikiService.fetchWikiGPSTracks(dateWanted);
  return results;
}
