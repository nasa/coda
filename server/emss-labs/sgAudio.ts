import * as LabsService from "server/services/emss-labs";
import { Source } from "utils/enums";

export default async function getLabsSgAudio(
  source: Source,
  dateWanted: string
): Promise<WrappedResponse<any>> {
  return LabsService.fetchSGActivity(source, dateWanted);
}
