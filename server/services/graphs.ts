import * as WikiService from "server/services/wiki-api";

export const fetchGraphsManifest = async (
  source: Source,
  dateWanted: string
): Promise<WrappedResponse<GraphsManifest>> => {
  const ancillaryDataSources = await WikiService.fetchAncillaryDataSourceList();

  // Check if there is a video override for this date and Source
  const ancillaryDataSource = ancillaryDataSources.data.find((vo) => {
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
      const res = await fetch(ancillaryDataSource.url);
      graphManifest = await res.json();
    } catch (e) {
      return {
        cacheMetadata: { fromCache: false, stale: false, timestamp: new Date(), error: null },
        data: null,
      };
    }
    return {
      cacheMetadata: { fromCache: false, stale: false, timestamp: new Date() },
      data: graphManifest,
    };
  }

  return {
    cacheMetadata: { fromCache: false, stale: false, timestamp: new Date() },
    data: null,
  };
};
