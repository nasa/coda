import * as WikiService from "server/services/wiki-api";

export default async function getEVAData(agency: Agency): Promise<WikibotResponse<Sequence[]>> {
  return WikiService.getAllEVAData(agency);
}
