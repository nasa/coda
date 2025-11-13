import * as DbService from "server/services/db-api";
import fetchWithTimeout from "utils/fetch-with-timeout";

const buildResponse = (
  data: GraphsManifest | null,
  options: { success: boolean; error?: string }
): FetchResponse<GraphsManifest> => ({
  data,
  fetchMetadata: {
    success: options.success,
    error: options.error,
    timestamp: new Date().toISOString(),
  },
  source: options.success ? "ancillary" : undefined,
});

export const fetchGraphsManifest = async (
  source: Source,
  dateWanted: string
): Promise<FetchResponse<GraphsManifest>> => {
  const ancillaryDataSources = await DbService.fetchAncillaryDataSourceList();

  const ancillaryDataSource = ancillaryDataSources?.find((vo) => {
    const overrideDate = new Date(vo.date);
    const requestedDate = new Date(dateWanted);
    return (
      overrideDate.getTime() === requestedDate.getTime() &&
      vo.source === source &&
      vo.type === "graphs"
    );
  });

  if (ancillaryDataSource) {
    try {
      const res = await fetchWithTimeout(ancillaryDataSource.url);
      const graphManifest = (await res.json()) as GraphsManifest;
      return buildResponse(graphManifest ?? null, { success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load graphs manifest";
      return buildResponse(null, { success: false, error: message });
    }
  }

  // No ancillary data source found for this date and type. This is not an error; just return empty data.
  return buildResponse(null, { success: true });
};
