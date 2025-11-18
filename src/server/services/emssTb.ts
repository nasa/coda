import fetchWithTimeout from "utils/fetch-with-timeout";
import leoProfanity from "leo-profanity";

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

export async function fetchTalkybotSGAudio({
  source,
  dateWanted,
  overrideBaseUrl,
}: {
  source: Source;
  dateWanted: string;
  overrideBaseUrl?: string;
}): Promise<SgActivityFullUrlRecord> {
  // if override URL is provided, use it
  if (overrideBaseUrl) {
    const url = `${overrideBaseUrl}/audioManifest.json`;
    let dayActivities: SgVideoRecord[] = [];

    try {
      const res = await fetchWithTimeout(url);
      dayActivities = (await res.json()) as SgVideoRecord[];
    } catch (e) {
      dayActivities = [];
    }

    const sgActivityRangeFullUrlRecords: SgActivityRangeFullUrlRecord[][] = [];
    for (let sgChannel = 0; sgChannel <= 3; sgChannel++) {
      const sgActivityRangeFullUrlRecord: SgActivityRangeFullUrlRecord[] = [];
      for (let videoIndex = 0; videoIndex < dayActivities.length; videoIndex++) {
        const video = dayActivities[videoIndex];
        const activityRanges = video.sgChannels[sgChannel].activity_ranges;
        const reducedActivityRanges: SgActivityRangeFullUrlRecord[] = activityRanges.map(
          (activityRange) => {
            return {
              sound_start_secs: activityRange.sound_start_secs + video.start_seconds,
              sound_stop_secs: activityRange.sound_stop_secs + video.start_seconds,
              aacSegmentFullUrl: `${overrideBaseUrl}/audio/${activityRange.aacSegmentFilename}`,
            };
          }
        );
        sgActivityRangeFullUrlRecord.push(...reducedActivityRanges);
      }
      sgActivityRangeFullUrlRecord.sort((a, b) =>
        a.sound_start_secs > b.sound_start_secs
          ? 1
          : b.sound_start_secs > a.sound_start_secs
            ? -1
            : 0
      );
      sgActivityRangeFullUrlRecords.push(sgActivityRangeFullUrlRecord);
    }

    return {
      override: true,
      sgActivityRangeFullUrlRecords: sgActivityRangeFullUrlRecords,
    };
  }

  // if not ISS return nothing
  if (source !== "ISS") {
    return {
      override: false,
      sgActivityRangeFullUrlRecords: [[], [], [], []],
    } as SgActivityFullUrlRecord;
  }

  const url = `${process.env.TALKYBOT_URL}/api/v1/external/manifest/${dateWanted}`;

  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    return {
      override: false,
      sgActivityRangeFullUrlRecords: [[], [], [], []],
    } as SgActivityFullUrlRecord;
  }

  const resJson = await res.json();
  const manifest: TBExternalManifest = resJson;

  const sgActivityRangeFullUrlRecords: SgActivityRangeFullUrlRecord[][] = [];
  for (let sgChannel = 1; sgChannel <= 4; sgChannel++) {
    const sgChannels = manifest.channels;
    // get the activity ranges for the sgChannel using the sgChannel property in sgChannels
    const activity = sgChannels.find((val) => val.channel === sgChannel).activity;
    const sgChannelActivityRangeFullUrlRecord: SgActivityRangeFullUrlRecord[] = activity.map(
      (val) => {
        return {
          sound_start_secs: val.start,
          sound_stop_secs: val.stop,
          aacSegmentFullUrl: `${process.env.TALKYBOT_URL}/api/v1/external/audiofiles/${val.uuid}/file`,
        };
      }
    );
    sgActivityRangeFullUrlRecords.push(sgChannelActivityRangeFullUrlRecord);
  }

  return {
    override: false,
    sgActivityRangeFullUrlRecords: sgActivityRangeFullUrlRecords,
  };
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
