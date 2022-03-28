import * as WikiService from "server/services/wiki-api";
import { Source } from "utils/enums";

export default async function getWikiTranscript(
  source: Source,
  dateWanted: string
): Promise<WikibotResponse<string>> {
  return WikiService.fetchWikiTranscript(source, dateWanted);
}
