import * as WikiService from "server/services/wiki-api";

export default async function getTestEventsData(
  forceNew: boolean
): Promise<WikibotResponse<Sequence[]>> {
  const response = await WikiService.getAllTestEventsData(forceNew);
  if (!response.data) {
    // Return an empty array if there's no last known good data.
    // This is neede because the front-end can't deal with null.
    return { ...response, data: [] };
  }
  return response;
}
