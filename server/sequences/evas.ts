import * as WikiService from "server/services/wiki-api";
import type { WikibotResponse } from "typings";
import type { Sequence } from "typings/index";

export default async function getEVAData(): Promise<WikibotResponse<Sequence[]>> {
  return WikiService.getAllEVAData();
}
