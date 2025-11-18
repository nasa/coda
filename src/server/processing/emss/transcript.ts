import * as TbService from "server/services/emssTb";
import * as DbService from "server/services/db-api";

export default async function getTranscripts({
  source,
  dateWanted,
}: {
  source: Source;
  dateWanted: string; //yy-mm-dd
}): Promise<FetchResponse<UnprocessedTranscript[]>> {
  const requestedDate = new Date(dateWanted);

  // Fetch source overrides from the database for this date
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

    // if there are media overrides, use those
    if (mediaOverride) {
      const res: UnprocessedTranscript[] = await TbService.fetchTalkybotTranscripts({
        source,
        dateWanted,
        overrideBaseUrl: mediaOverride.url,
      });
      return {
        data: res,
        fetchMetadata: {
          success: true,
          timestamp: new Date().toISOString(),
        },
        source: "override",
      };
    }
  } catch (e) {
    // don't block results if media overrides call fails
    console.error(e);
  }

  // Fetch transcripts from Talkybot
  const res: UnprocessedTranscript[] = await TbService.fetchTalkybotTranscripts({
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
