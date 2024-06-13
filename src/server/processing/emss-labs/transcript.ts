import * as LabsService from "server/services/emss-labs";
import * as WikiService from "server/services/wiki-api";
import { Source } from "utils/enums";

export default async function getLabsTranscripts(
  source: Source,
  dateWanted: string, //yy-mm-dd
  forceNew: boolean
): Promise<WrappedResponse<UnprocessedTranscript[]>> {
  const requestedDate = new Date(dateWanted);

  // Fetch source overrides from the wiki for this date. If there are none, then use Imagery Online
  try {
    let mediaOverrides = await WikiService.fetchMediaOverrides(forceNew);

    if (mediaOverrides?.responseMetadata?.retrieverStatus === "inprogress") {
      // try once per second for up to 10 seconds
      let tries = 0;
      while (mediaOverrides?.responseMetadata?.retrieverStatus === "inprogress" && tries < 10) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        mediaOverrides = await WikiService.fetchMediaOverrides();
        tries++;
      }
    }

    // Check if there is a transcript override for this date and Source
    const mediaOverride = mediaOverrides?.data?.find((vo) => {
      const overrideDate = new Date(vo.date);
      return (
        overrideDate.getTime() === requestedDate.getTime() &&
        vo.source === source &&
        vo.type === "transcript"
      );
    });

    // if there are media overrides, use those instead of labs
    if (mediaOverride) {
      return LabsService.fetchLabsTranscripts(source, dateWanted, mediaOverride.url);
    }
  } catch (e) {
    // don't block results if media overrides call fails
    console.error(e);
  }

  return LabsService.fetchLabsTranscripts(source, dateWanted);
}
