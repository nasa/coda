import * as AncillaryService from "server/services/graphs";

export default async function getGraphManifest(params: {
  source: Source;
  dateWanted: string;
  forceNew: boolean;
}): Promise<WrappedResponse<GraphsManifest>> {
  const { source, dateWanted, forceNew } = params;
  const results = await AncillaryService.fetchGraphsManifest(source, dateWanted, forceNew);
  return results;
}
