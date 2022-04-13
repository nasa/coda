import * as LabsService from "server/services/emss-labs";
import { Source } from "utils/enums";

export default async function getLabsTranscripts(
  source: Source,
  dateWanted: string
): Promise<WrappedResponse<UnprocessedTranscript[]>> {
  return LabsService.fetchLabsTranscripts(source, dateWanted);
}
