import * as AncillaryService from "server/services/ancillary";

export default async function getGraphManifest(
  dateWanted: string
): Promise<WrappedResponse<GraphsManifest>> {
  const results = await AncillaryService.fetchGraphsManifest(dateWanted);
  return results;
}
