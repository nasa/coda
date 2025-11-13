import * as WikiService from "server/services/wiki-api";

const ensureData = (response: FetchResponse<Sequence[]>): FetchResponse<Sequence[]> => {
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
};

export default async function getEVAData(agency: AgencyQuery): Promise<FetchResponse<Sequence[]>> {
  const response = await WikiService.getAllEVAData(agency);
  return ensureData(response);
}

export async function getISSEvaData({
  // ignore source and dateWanted. We only have those parameters set to make this function compatible with the other socket fetch functions.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  dateWanted,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  source,
}: {
  dateWanted: string;
  source?: string;
}): Promise<FetchResponse<Sequence[]>> {
  const response = await WikiService.getAllEVAData("all");
  return ensureData(response);
}
