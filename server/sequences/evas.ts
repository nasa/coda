import * as WikiService from "server/services/wiki-api";

export default async function getEVAData(
  agency: AgencyQuery,
  forceNew: boolean
): Promise<WikibotResponse<Sequence[]>> {
  return WikiService.getAllEVAData(agency, forceNew);
}
