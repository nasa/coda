import { Source } from "utils/enums";
import fetchWithTimeout from "utils/fetch-with-timeout";
import * as filter from "leo-profanity";

export async function fetchLabsTranscripts(
  source: Source,
  dateWanted: string,
  overrideBaseUrl?: string
): Promise<WrappedResponse<UnprocessedTranscript[]>> {
  // if not ISS return nothing unless an override URL has been send, then use the override URL
  if (source !== Source.ISS && !overrideBaseUrl) {
    return {
      responseMetadata: {
        retrieverStatus: "complete",
        cachedTimestamp: new Date().toISOString(),
        expiration: null,
        error: null,
        retrieverErrorCount: 0,
        lastErrorTimestamp: null,
      },
      data: returnEmptyUnprocessedTranscriptArray(),
    };
  }

  const transcripts: UnprocessedTranscript[] = [];

  filter.loadDictionary();

  // Get all 4 S/G transcript files. If 404 is returned, then return an empty unprocessed utterance array.
  const urlBase = overrideBaseUrl
    ? overrideBaseUrl
    : `https://emss-labs.fit.nasa.gov/transcriptions/${dateWanted}`;

  for (let i = 1; i <= 4; i++) {
    const url = `${urlBase}/transcript-SG${i}.json`;
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
      utterance[2] = filter.clean(utterance[2]);
    });
    transcripts[i - 1] = unprocessedTranscript;
  }

  const returnVal: WrappedResponse<UnprocessedTranscript[]> = {
    responseMetadata: {
      retrieverStatus: "complete",
      cachedTimestamp: new Date().toISOString(),
      expiration: null,
      error: null,
      retrieverErrorCount: 0,
      lastErrorTimestamp: null,
    },
    data: transcripts,
  };

  return returnVal;
}

export async function fetchSGActivity(
  source: Source,
  dateWanted: string,
  overrideBaseUrl?: string
): Promise<WrappedResponse<SgActivityRecord>> {
  if (source !== Source.ISS && !overrideBaseUrl) {
    return {
      responseMetadata: {
        retrieverStatus: "complete",
        cachedTimestamp: new Date().toISOString(),
        expiration: null,
        error: null,
        retrieverErrorCount: 0,
        lastErrorTimestamp: null,
      },
      data: {
        overrideBaseUrl: null,
        sgActivityRangeRecords: [[], [], [], []],
      } as SgActivityRecord,
    };
  }
  const url = overrideBaseUrl
    ? `${overrideBaseUrl}/audioManifest.json`
    : `https://emss-labs.fit.nasa.gov/transcriptions/${dateWanted}/day-activity.json`;

  let dayActivities: SgVideoRecord[] = [];
  try {
    const res = await fetchWithTimeout(url);
    dayActivities = (await res.json()) as SgVideoRecord[];
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
          sound_start_secs: activityRange.sound_start_secs + video.start_seconds,
          sound_stop_secs: activityRange.sound_stop_secs + video.start_seconds,
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

  const returnVal: WrappedResponse<SgActivityRecord> = {
    responseMetadata: {
      retrieverStatus: "complete",
      cachedTimestamp: new Date().toISOString(),
      expiration: null,
      error: null,
      retrieverErrorCount: 0,
      lastErrorTimestamp: null,
    },
    data: {
      overrideBaseUrl: overrideBaseUrl ? overrideBaseUrl : null,
      sgActivityRangeRecords: sgChannelsActivityRanges,
    } as SgActivityRecord,
  };
  return returnVal;
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
