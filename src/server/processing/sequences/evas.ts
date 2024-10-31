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
