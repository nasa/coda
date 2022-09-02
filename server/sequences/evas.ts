import * as WikiService from "server/services/wiki-api";

export default async function getEVAData(
  agency: AgencyQuery
): Promise<WikibotResponse<Sequence[]>> {
  return WikiService.getAllEVAData(agency);
}
