import { getAncillaryDataSourceList } from "server/processing/ancillaryDataSources";
import fetchWithTimeout from "utils/fetch-with-timeout";

const buildResponse = <T extends GraphsManifest | null>(
  data: T,
  options: { success: boolean; error?: string }
): FetchResponse<T> => ({
  data,
  fetchMetadata: {
    success: options.success,
    error: options.error,
    timestamp: new Date().toISOString(),
  },
});

export const getGraphManifest = async ({
  source,
  dateWanted,
}: {
  source: Source;
  dateWanted: string;
}): Promise<FetchResponse<GraphsManifest | null>> => {
  const ancillaryDataSources = await getAncillaryDataSourceList();

  const ancillaryDataSource = ancillaryDataSources?.find((ancillaryDataSourceList) => {
    const overrideDate = new Date(ancillaryDataSourceList.date);
    const requestedDate = new Date(dateWanted);
    return (
      overrideDate.getTime() === requestedDate.getTime() &&
      ancillaryDataSourceList.source === source &&
      ancillaryDataSourceList.type === "graphs"
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

export default getGraphManifest;
