import * as LabsService from "server/services/emss";
import * as DbService from "server/services/db-api";

export default async function getTranscripts({
  source,
  dateWanted,
}: {
  source: Source;
  dateWanted: string; //yy-mm-dd
}): Promise<FetchResponse<UnprocessedTranscript[]>> {
  const requestedDate = new Date(dateWanted);

  // Fetch source overrides from the wiki for this date. If there are none, then use Imagery Online
  try {
    let mediaOverrides = await DbService.fetchMediaOverrides();

    // Check if there is a transcript override for this date and Source
    const mediaOverride = mediaOverrides?.find((vo) => {
      const overrideDate = new Date(vo.date);
      return (
        overrideDate.getTime() === requestedDate.getTime() &&
        vo.source === source &&
        vo.type === "transcript"
      );
    });

    // if there are media overrides, use those instead of labs
    if (mediaOverride) {
      return LabsService.fetchLabsTranscripts({
        source,
        dateWanted,
        overrideBaseUrl: mediaOverride.url,
      });
    }
  } catch (e) {
    // don't block results if media overrides call fails
    console.error(e);
  }

  // labs audio and transcription was turned off around late October. Only grab from TB after this date
  // to avoid messy merging of labs and talkybot  transcripts
  if (new Date(dateWanted).getTime() < new Date("2024-10-21T00:00:00").getTime()) {
    return LabsService.fetchLabsAndTalkybotTranscripts({
      source,
      dateWanted,
    });
  } else {
    const res: UnprocessedTranscript[] = await LabsService.fetchTalkybotTranscripts({
      source,
      dateWanted,
    });
    return {
      data: res,
      fetchMetadata: {
        success: true,
        timestamp: new Date().toISOString(),
      },
      source: "talky-bot",
    };
  }
}
