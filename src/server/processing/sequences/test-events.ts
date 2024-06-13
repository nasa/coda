import * as WikiService from "server/services/wiki-api";

export default async function getTestEventsData(
  forceNew: boolean
): Promise<WikibotResponse<Sequence[]>> {
  return WikiService.getAllTestEventsData(forceNew);
}
