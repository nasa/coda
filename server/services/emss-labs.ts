import { Source } from "utils/enums";

export async function fetchLabsTranscripts(
  source: Source,
  dateWanted: string
): Promise<WrappedResponse<UnprocessedTranscript[]>> {
  const transcripts: UnprocessedTranscript[] = [];

  const filter = require("leo-profanity");
  filter.loadDictionary();

  // Get all 4 S/G transcript files. If 404 is returned, then return an empty unprocessed utterance array.
  for (let i = 1; i <= 4; i++) {
    const url = `https://emss-labs.fit.nasa.gov/transcriptions/${dateWanted}/transcript-SG${i}.json`;
    const unprocessedTranscript: UnprocessedTranscript = {
      sgNum: i,
      unprocessedUtterances: [],
    };
    try {
      const res = await fetch(url);
      unprocessedTranscript.unprocessedUtterances = await res.json();
    } catch (e) {
      unprocessedTranscript.unprocessedUtterances = [];
    }
    // Filter the utterances for bad words
    unprocessedTranscript.unprocessedUtterances.forEach((utterance) => {
      utterance[2] = filter.clean(utterance[2]);
    });
    transcripts[i - 1] = unprocessedTranscript;
  }

  const returnVal: WrappedResponse<UnprocessedTranscript[]> = {
    cacheMetadata: { fromCache: false, stale: false, timestamp: new Date() },
    data: transcripts,
  };

  return returnVal;
}

export async function fetchSGActivity(
  source: Source,
  dateWanted: string
): Promise<WrappedResponse<SgActivityRangeRecord[][]>> {
  if (source !== Source.ISS) {
    return {
      cacheMetadata: {
        fromCache: false,
        stale: false,
        timestamp: new Date(),
        error: "Source not supported",
      },
      data: null,
    };
  }
  const url = `https://emss-labs.fit.nasa.gov/transcriptions/${dateWanted}/day-activity.json`;

  let dayActivities: SgVideoRecord[] = [];
  try {
    const res = await fetch(url);
    dayActivities = await res.json();
  } catch (e) {
    dayActivities = [];
  }

  const sgChannelsActivityRanges: SgActivityRangeRecord[][] = [];
  for (let sgChannel = 0; sgChannel <= 3; sgChannel++) {
    const sgChannelActivityRanges: SgActivityRangeRecord[] = [];
    for (let videoIndex = 0; videoIndex < dayActivities.length; videoIndex++) {
      const video = dayActivities[videoIndex];
      const activityRanges = video.sgChannels[sgChannel].activity_ranges;
      const reducedActivityRanges = activityRanges.map((activityRange) => {
        return {
          sound_start_secs: activityRange.sound_start_secs,
          sound_stop_secs: activityRange.sound_stop_secs,
          aacSegmentFilename: activityRange.aacSegmentFilename,
        };
      });
      sgChannelActivityRanges.push(...reducedActivityRanges);
    }
    sgChannelActivityRanges.sort((a, b) =>
      a.sound_start_secs > b.sound_start_secs ? 1 : b.sound_start_secs > a.sound_start_secs ? -1 : 0
    );
    sgChannelsActivityRanges.push(sgChannelActivityRanges);
  }

  const returnVal: WrappedResponse<SgActivityRangeRecord[][]> = {
    cacheMetadata: { fromCache: false, stale: false, timestamp: new Date() },
    data: sgChannelsActivityRanges,
  };
  return returnVal;
}
