import * as WikiService from "server/services/wiki-api";

export default async function getTestEventsData(): Promise<FetchResponse<Sequence[]>> {
  const response = await WikiService.getAllTestEventsData();
  if (!response.data) {
    return {
      ...response,
      data: [],
      fetchMetadata: {
        ...response.fetchMetadata,
        success: response.fetchMetadata?.success ?? true,
        timestamp: response.fetchMetadata?.timestamp || new Date().toISOString(),
      },
    };
  }
  return response;
}
