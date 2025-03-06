import * as WikiService from "server/services/wiki-api";

export default async function getEVAData(
  agency: AgencyQuery,
  forceNew: boolean
): Promise<WikibotResponse<Sequence[]>> {
  const response = await WikiService.getAllEVAData(agency, forceNew);
  if (!response.data) {
    // Return an empty array if there's no last known good data.
    // This is neede because the front-end can't deal with null.
    return { ...response, data: [] };
  }
  return response;
}

export async function getISSEvaData({
  // ignore source and dateWanted. We only have those parameters set to make this function compatible with the other socket fetch functions.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  dateWanted,
  forceNew,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  source,
}: {
  dateWanted: string;
  forceNew: boolean;
  source?: string;
}): Promise<WikibotResponse<Sequence[]>> {
  const response = await WikiService.getAllEVAData("all", forceNew);
  if (!response.data) {
    // Return an empty array if there's no last known good data.
    // This is neede because the front-end can't deal with null.
    return { ...response, data: [] };
  }
  return response;
}
