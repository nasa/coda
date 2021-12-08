import * as WikiService from "server/services/wiki-api";
import type { WikibotResponse } from "typings";
import type { Sequence } from "typings/index";

export default async function getTestEventsData(): Promise<WikibotResponse<Sequence[]>> {
  return WikiService.getAllTestEventsData();
}
