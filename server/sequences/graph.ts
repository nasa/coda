import * as AncillaryService from "server/services/ancillary";

export default async function getGraphManifest(
  dateWanted: string
): Promise<WrappedResponse<GraphManifest>> {
  const results = await AncillaryService.fetchGraphManifest(dateWanted);
  return results;
}
