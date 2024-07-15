import * as AncillaryService from "server/services/graphs";

export default async function getGraphManifest(params: {
  source: Source;
  dateWanted: string;
}): Promise<WrappedResponse<GraphsManifest>> {
  const { source, dateWanted } = params;
  const results = await AncillaryService.fetchGraphsManifest(source, dateWanted);
  return results;
}
