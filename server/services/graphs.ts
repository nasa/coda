import * as WikiService from "server/services/wiki-api";
import fetchWithTimeout from "utils/fetch-with-timeout";

export const fetchGraphsManifest = async (
  source: Source,
  dateWanted: string,
  forceNew?: boolean
): Promise<WrappedResponse<GraphsManifest>> => {
  const ancillaryDataSources = await WikiService.fetchAncillaryDataSourceList(forceNew);

  // Check if there is a video override for this date and Source
  const ancillaryDataSource = ancillaryDataSources?.data?.find((vo) => {
    const overrideDate = new Date(vo.date);
    const requestedDate = new Date(dateWanted);
    return (
      overrideDate.getTime() === requestedDate.getTime() &&
      vo.source === source &&
      vo.type === "graphs"
    );
  });

  if (ancillaryDataSource) {
    // Get the graph manifest json from the url in the wiki
    let graphManifest: GraphsManifest = null;
    try {
      const res = await fetchWithTimeout(ancillaryDataSource.url);
      graphManifest = await res.json();
    } catch (e) {
      return {
        cacheMetadata: { fromCache: false, timestamp: new Date(), expiration: null, error: null },
        data: null,
      };
    }
    return {
      cacheMetadata: { fromCache: false, timestamp: new Date(), expiration: null },
      data: graphManifest,
    };
  }

  return {
    cacheMetadata: { fromCache: false, timestamp: new Date(), expiration: null },
    data: null,
  };
};
