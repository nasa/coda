import * as WikiService from "server/services/wiki-api";

export default async function getTestEventsData({
  // ignore source and dateWanted. We only have those parameters set to make this function compatible with the other socket fetch functions.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  dateWanted,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  source,
  forceNew,
}: {
  dateWanted?: string;
  source?: Source;
  forceNew: boolean;
}): Promise<WikibotResponse<Sequence[]>> {
  const response = await WikiService.getAllTestEventsData(forceNew);
  if (!response.data) {
    // Return an empty array if there's no last known good data.
    // This is neede because the front-end can't deal with null.
    return { ...response, data: [] };
  }
  return response;
}
