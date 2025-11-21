import fetchWithTimeout from "utils/fetch-with-timeout";
import leoProfanity from "leo-profanity";
import { getMediaOverridesList } from "server/express/routes/db/mediaOverrides";

export default async function getTalkybotTranscripts({
  source,
  dateWanted,
}: {
  source: Source;
  dateWanted: string; //yy-mm-dd
}): Promise<FetchResponse<UnprocessedTranscript[]>> {
  const requestedDate = new Date(dateWanted);

  // Fetch source overrides from the database for this date
  try {
    const mediaOverrides = await getMediaOverridesList();

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
      const res: UnprocessedTranscript[] = await fetchTalkybotTranscripts({
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
        origin: "override",
      };
    }
  } catch (e) {
    // don't block results if media overrides call fails
    console.error(e);
  }

  // Fetch transcripts from Talkybot
  const res: UnprocessedTranscript[] = await fetchTalkybotTranscripts({
    source,
    dateWanted,
  });
  return {
    data: res,
    fetchMetadata: {
      success: true,
      timestamp: new Date().toISOString(),
    },
    origin: "talky-bot",
  };
}

export async function fetchTalkybotTranscripts({
  source,
  dateWanted,
  overrideBaseUrl,
}: {
  source: Source;
  dateWanted: string;
  overrideBaseUrl?: string;
}): Promise<UnprocessedTranscript[]> {
  // if override URL is provided, use it
  if (overrideBaseUrl) {
    leoProfanity.loadDictionary("en");
    const transcripts: UnprocessedTranscript[] = [];

    // Get all 4 S/G transcript files from override URL
    for (let i = 1; i <= 4; i++) {
      const url = `${overrideBaseUrl}/transcript-SG${i}.json`;
      const unprocessedTranscript: UnprocessedTranscript = {
        sgNum: i,
        unprocessedUtterances: [],
      };

      try {
        const res = await fetchWithTimeout(url);
        unprocessedTranscript.unprocessedUtterances = (await res.json()) as UnprocessedUtterance[];
      } catch (e) {
        unprocessedTranscript.unprocessedUtterances = [];
      }
      // Filter the utterances for bad words
      unprocessedTranscript.unprocessedUtterances.forEach((utterance) => {
        utterance[2] = leoProfanity.clean(utterance[2]);
      });
      transcripts[i - 1] = unprocessedTranscript;
    }
    return transcripts;
  }

  // if not ISS return nothing
  if (source !== "ISS") {
    return returnEmptyUnprocessedTranscriptArray();
  }

  const transcripts: UnprocessedTranscript[] = [];
  const urlBase = `${process.env.TALKYBOT_URL}/api/v1/external/transcript/${dateWanted}`;
  // Get all 4 S/G transcript files. If 404 is returned, then return an empty unprocessed utterance array.
  for (let i = 1; i <= 4; i++) {
    const url = `${urlBase}/channel/${i}`;
    const unprocessedTranscript: UnprocessedTranscript = {
      sgNum: i,
      unprocessedUtterances: [],
    };

    try {
      const res = await fetchWithTimeout(url);
      const resJson = await res.json();
      unprocessedTranscript.unprocessedUtterances = resJson as UnprocessedUtterance[];
    } catch (e) {
      unprocessedTranscript.unprocessedUtterances = [];
    }
    // Filter the utterances for bad words
    unprocessedTranscript.unprocessedUtterances.forEach((utterance) => {
      utterance[2] = leoProfanity.clean(utterance[2]);
    });
    transcripts[i - 1] = unprocessedTranscript;
  }

  return transcripts;
}

function returnEmptyUnprocessedTranscriptArray(): UnprocessedTranscript[] {
  const emptyReponse: UnprocessedTranscript[] = [];
  for (let i = 1; i <= 3; i++) {
    emptyReponse.push({
      sgNum: i,
      unprocessedUtterances: [],
    });
  }
  return emptyReponse;
}
