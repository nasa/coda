import * as AncillaryService from "server/services/graphs";

export default async function getGraphManifest({
  source,
  dateWanted,
}: {
  source: Source;
  dateWanted: string;
}): Promise<WrappedResponse<GraphsManifest>> {
  const results = await AncillaryService.fetchGraphsManifest(source, dateWanted);
  return results;
}
