import * as AncillaryService from "server/services/graphs";

export default async function getGraphManifest(
  source: Source,
  dateWanted: string,
  forceNew: boolean
): Promise<WrappedResponse<GraphsManifest>> {
  const results = await AncillaryService.fetchGraphsManifest(source, dateWanted, forceNew);
  return results;
}
