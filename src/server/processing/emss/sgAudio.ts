import * as LabsService from "server/services/emss";
import * as DbService from "server/services/db-api";

export default async function getLabsSgAudio(params: {
  source: Source;
  dateWanted: string; //yy-mm-dd
}): Promise<WrappedResponse<SgActivityFullUrlRecord>> {
  const { source, dateWanted } = params;
  const requestedDate = new Date(dateWanted);

  // Fetch source overrides from the wiki for this date. If there are none, then use Imagery Online
  try {
    let mediaOverrides = await DbService.fetchMediaOverrides();

    // Check if there is a media override for this date and Source
    const mediaOverride = mediaOverrides?.find((vo) => {
      const overrideDate = new Date(vo.date);
      return (
        overrideDate.getTime() === requestedDate.getTime() &&
        vo.source === source &&
        vo.type === "audio"
      );
    });

    // if there are media overrides, use those instead of labs
    if (mediaOverride) {
      return LabsService.fetchLabsSGAudio(source, dateWanted, mediaOverride.url);
    }
  } catch (e) {
    // don't block results if media overrides call fails
    console.error(e);
  }

  return LabsService.fetchLabsAndTalkybotSGAudio(source, dateWanted);
}
