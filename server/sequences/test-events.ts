import * as WikiService from "server/services/wiki-api";

export default async function getTestEventsData(): Promise<WikibotResponse<Sequence[]>> {
  return WikiService.getAllTestEventsData();
}
