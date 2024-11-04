import * as LabsService from "server/services/emss";
import * as DbService from "server/services/db-api";

export default async function getLabsSgAudio({
  source,
  dateWanted,
  forceNew,
}: {
  source: Source;
  dateWanted: string; //yy-mm-dd
  forceNew: boolean;
}): Promise<WrappedResponse<SgActivityFullUrlRecord>> {
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
      return LabsService.fetchLabsSGAudio({
        source,
        dateWanted,
        overrideBaseUrl: mediaOverride.url,
        forceNew,
      });
    }
  } catch (e) {
    // don't block results if media overrides call fails
    console.error(e);
  }

  // labs audio and transcription was turned off around late October. Only grab from TB after this date
  // to avoid messy merging of labs and talkybot transcripts
  if (new Date(dateWanted).getTime() < new Date("2024-10-21T00:00:00").getTime()) {
    return LabsService.fetchLabsAndTalkybotSGAudio({ source, dateWanted, forceNew });
  } else {
    const res: SgActivityFullUrlRecord = await LabsService.fetchTalkybotSGAudio({
      dateWanted,
    });
    // wrap the response
    return {
      responseMetadata: {
        retrieverStatus: "complete",
        cachedTimestamp: new Date().toISOString(),
        expiration: null,
        error: "",
        retrieverErrorCount: 0,
        lastErrorTimestamp: null,
      },
      data: res,
      source: "talky-bot",
    };
  }
}
