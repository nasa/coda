import { collection } from "utils/consts";
import fetchWithTimeout from "utils/fetch-with-timeout";
import leoProfanity from "leo-profanity";
import fetchWithCache from "../processing/cache-client";
import { isNearRealTime } from "utils/formatting";
import { getVideoCoverageTimeRanges } from "server/processing/media/videos";
import { midnightZulu } from "utils/date";
import clone from "lodash/clone";

export async function fetchLabsAndTalkybotTranscripts({
  source,
  dateWanted,
  forceNew = false,
}: {
  source: Source;
  dateWanted: string;
  forceNew?: boolean;
}): Promise<WrappedResponse<UnprocessedTranscript[]>> {
  if (source !== "ISS") {
    return await fetchLabsTranscripts({ source, dateWanted, forceNew });
  }

  // get both, the labs and talkybot transcripts
  let labsResponse = await fetchLabsTranscripts({ source, dateWanted });
  let retries = 0;
  while (labsResponse.responseMetadata.retrieverStatus === "inprogress" && retries < 10) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    labsResponse = await fetchLabsTranscripts({ source, dateWanted, forceNew });
    retries++;
  }
  const labsTranscripts = labsResponse.data;
  const tbTranscripts = await fetchTalkybotTranscripts({ source, dateWanted });

  // if no TB response, just return labs
  if (tbTranscripts.length === 0) {
    return labsResponse;
  }

  // get the time ranges of all IO videos for this date
  const videoCoverageTimeRanges = await getVideoCoverageTimeRanges({
    dateWanted,
    source,
    forceNew: false,
  });

  // Start with the full labs transcript
  // Merge the talkybot transcripts into the result by using the video coverage from IO. If there is a video for a given utterance time, that means we have transcribed any audio in that timerange already we should ignore any TB utterances at that time. If there is not video coverage during an utterance, we should use the TB utterance.
  const mergedTranscripts: UnprocessedTranscript[] = [];
  for (let i = 0; i < 4; i++) {
    const tbTranscript = tbTranscripts[i];
    const labsTranscript = labsTranscripts[i];
    // copy the whole labs transcript first
    const mergedTranscript: UnprocessedTranscript = {
      sgNum: i + 1,
      unprocessedUtterances: [...labsTranscript.unprocessedUtterances],
    };

    for (const tbUtterance of tbTranscript.unprocessedUtterances) {
      // if the tbUtterance time falls outside of the video coverage time ranges, add it to the merged transcript
      let shouldAdd = true;
      for (const videoCoverageTimeRange of videoCoverageTimeRanges) {
        if (
          tbUtterance[0] >= videoCoverageTimeRange[0] &&
          tbUtterance[0] <= videoCoverageTimeRange[1]
        ) {
          shouldAdd = false;
          break;
        }
      }
      if (shouldAdd) {
        tbUtterance[2] = tbUtterance[2] + " [TB]";
        mergedTranscript.unprocessedUtterances.push(tbUtterance);
      }
    }
    mergedTranscripts.push(mergedTranscript);
  }

  // sort the merged transcripts by time
  mergedTranscripts.forEach((transcript) => {
    transcript.unprocessedUtterances.sort((a, b) => a[0] - b[0]);
  });

  const response: WrappedResponse<UnprocessedTranscript[]> = {
    responseMetadata: labsResponse.responseMetadata,
    data: mergedTranscripts,
  };

  return response;
}

export async function fetchLabsTranscripts({
  source,
  dateWanted,
  overrideBaseUrl,
  forceNew = false,
}: {
  source: Source;
  dateWanted: string;
  overrideBaseUrl?: string;
  forceNew?: boolean;
}): Promise<WrappedResponse<UnprocessedTranscript[]>> {
  // if not ISS return nothing unless an override URL has been send, then use the override URL
  if (source !== "ISS" && !overrideBaseUrl) {
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

  const cacheAge = isNearRealTime(new Date(dateWanted).getTime(), collection[source]) ? 0 : 60;

  leoProfanity.loadDictionary("en");

  const retriever = async (): Promise<UnprocessedTranscript[]> => {
    const transcripts: UnprocessedTranscript[] = [];
    const urlBase = overrideBaseUrl
      ? overrideBaseUrl
      : `https://emss-labs.fit.nasa.gov/transcriptions/${dateWanted}`;

    // Get all 4 S/G transcript files. If 404 is returned, then return an empty unprocessed utterance array.
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
        utterance[2] = leoProfanity.clean(utterance[2]);
      });
      transcripts[i - 1] = unprocessedTranscript;
    }
    return transcripts;
  };

  const res: WrappedResponse<UnprocessedTranscript[]> = await fetchWithCache<
    UnprocessedTranscript[]
  >({
    identifier: `${dateWanted}`,
    cacheFolder: "labs/transcripts",
    retriever,
    cacheAge,
    forceRetriever: forceNew,
  });

  return { ...res, source: "labs" };
}

export async function fetchTalkybotTranscripts({
  source,
  dateWanted,
}: {
  source: Source;
  dateWanted: string;
}): Promise<UnprocessedTranscript[]> {
  // if not ISS return nothing
  if (source !== "ISS") {
    return returnEmptyUnprocessedTranscriptArray();
  }

  const transcripts: UnprocessedTranscript[] = [];
  const urlBase = `${process.env.TALKYBOT_URL}/api/v1/external/${dateWanted}`;
  // Get all 4 S/G transcript files. If 404 is returned, then return an empty unprocessed utterance array.
  for (let i = 1; i <= 4; i++) {
    const url = `${urlBase}/transcript-SG${i}.json`;
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

export async function fetchLabsAndTalkybotSGAudio({
  source,
  dateWanted,
  overrideBaseUrl = null,
  forceNew = false,
}: {
  source: Source;
  dateWanted: string;
  overrideBaseUrl?: string;
  forceNew?: boolean;
}): Promise<WrappedResponse<SgActivityFullUrlRecord>> {
  if (source !== "ISS") {
    return await fetchLabsSGAudio({ source, dateWanted, overrideBaseUrl, forceNew });
  }

  // get both, the labs and talkybot sgAudio
  let labsResponse = await fetchLabsSGAudio({ source, dateWanted, forceNew });
  let retries = 0;
  while (labsResponse.responseMetadata.retrieverStatus === "inprogress" && retries < 10) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    labsResponse = await fetchLabsSGAudio({ source, dateWanted, overrideBaseUrl });
    retries++;
  }
  const labsAudio = labsResponse.data;
  const tbAudio = await fetchTalkybotSGAudio({ source, dateWanted });

  // if no TB response, just return labs
  if (
    tbAudio.sgActivityRangeFullUrlRecords[0].length === 0 &&
    tbAudio.sgActivityRangeFullUrlRecords[1].length === 0 &&
    tbAudio.sgActivityRangeFullUrlRecords[2].length === 0 &&
    tbAudio.sgActivityRangeFullUrlRecords[3].length === 0
  ) {
    return labsResponse;
  }

  // Start with the full labs audio
  // Merge the talkybot audio into the result by using the video coverage from IO. If there is a video for a given utterance time, that

  // get the time ranges of all IO videos for this date
  const videoCoverageTimeRanges = await getVideoCoverageTimeRanges({
    dateWanted,
    source,
    forceNew: false,
  });

  // Start with the full labs audio
  const mergedAudio: SgActivityFullUrlRecord = {
    override: labsAudio.override,
    sgActivityRangeFullUrlRecords: [],
  };

  for (let i = 0; i < 4; i++) {
    const tbAudioRanges = tbAudio.sgActivityRangeFullUrlRecords[i];
    const labsAudioRanges = labsAudio.sgActivityRangeFullUrlRecords[i];
    const mergedRanges: SgActivityRangeFullUrlRecord[] = [];

    // copy the whole labs audio first
    mergedRanges.push(...labsAudioRanges);

    for (const tbRange of tbAudioRanges) {
      // if the tbRange time falls outside of the video coverage time ranges, add it to the merged audio
      let shouldAdd = true;
      for (const videoCoverageTimeRange of videoCoverageTimeRanges) {
        if (
          tbRange.sound_start_secs >= videoCoverageTimeRange[0] &&
          tbRange.sound_start_secs <= videoCoverageTimeRange[1]
        ) {
          shouldAdd = false;
          break;
        }
      }
      if (shouldAdd) {
        mergedRanges.push(tbRange);
      }
    }
    mergedRanges.sort((a, b) => a.sound_start_secs - b.sound_start_secs);
    mergedAudio.sgActivityRangeFullUrlRecords.push(mergedRanges);
  }

  return {
    responseMetadata: labsResponse.responseMetadata,
    data: mergedAudio,
  };
}

export async function fetchLabsSGAudio({
  source,
  dateWanted,
  overrideBaseUrl = null,
  forceNew = false,
}: {
  source: Source;
  dateWanted: string;
  overrideBaseUrl?: string;
  forceNew?: boolean;
}): Promise<WrappedResponse<SgActivityFullUrlRecord>> {
  if (source !== "ISS" && !overrideBaseUrl) {
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
        override: false,
        sgActivityRangeFullUrlRecords: [[], [], [], []],
      } as SgActivityFullUrlRecord,
    };
  }

  const cacheAge = isNearRealTime(new Date(dateWanted).getTime(), collection[source]) ? 0 : 60;

  const retriever = async (): Promise<SgActivityFullUrlRecord> => {
    const labsBaseUrl = "https://emss-labs.fit.nasa.gov/transcriptions";
    const baseUrl = overrideBaseUrl ? overrideBaseUrl : labsBaseUrl;
    const url = overrideBaseUrl
      ? `${overrideBaseUrl}/audioManifest.json`
      : `${labsBaseUrl}/${dateWanted}/day-activity.json`;

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
              aacSegmentFullUrl: overrideBaseUrl
                ? `${baseUrl}/audio/${activityRange.aacSegmentFilename}`
                : `${baseUrl}/${dateWanted}/audio_files/SG${sgChannel + 1}/${activityRange.aacSegmentFilename}`,
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
      override: overrideBaseUrl ? true : false,
      sgActivityRangeFullUrlRecords: sgActivityRangeFullUrlRecords,
    } as SgActivityFullUrlRecord;
  };

  const res: WrappedResponse<SgActivityFullUrlRecord> =
    await fetchWithCache<SgActivityFullUrlRecord>({
      identifier: `${dateWanted}`,
      cacheFolder: "labs/audio",
      retriever,
      cacheAge,
      forceRetriever: forceNew,
    });

  return { ...res, source: "labs" };
}

export async function fetchTalkybotSGAudio({
  source,
  dateWanted,
}: {
  source: Source;
  dateWanted: string;
}): Promise<SgActivityFullUrlRecord> {
  // if not ISS return nothing
  if (source !== "ISS") {
    return {
      override: false,
      sgActivityRangeFullUrlRecords: [[], [], [], []],
    } as SgActivityFullUrlRecord;
  }

  const url = `${process.env.TALKYBOT_URL}/api/v1/external/audio/${dateWanted}/audioManifest.json`;

  const res = await fetchWithTimeout(url);
  const resJson = await res.json();
  const audioManifestItem: AudioManifestItem = resJson[0];

  const sgActivityRangeFullUrlRecords: SgActivityRangeFullUrlRecord[][] = [];
  for (let sgChannel = 1; sgChannel <= 4; sgChannel++) {
    const sgChannels = audioManifestItem.sgChannels;
    // get the activity ranges for the sgChannel using the sgChannel property in sgChannels
    const activityRanges = sgChannels.find((sgc) => sgc.sgChannel === sgChannel).activity_ranges;
    const sgChannelActivityRangeFullUrlRecord: SgActivityRangeFullUrlRecord[] = activityRanges.map(
      (activityRange) => {
        return {
          sound_start_secs: activityRange.sound_start_secs,
          sound_stop_secs: activityRange.sound_stop_secs,
          aacSegmentFullUrl: `${process.env.TALKYBOT_URL}/api/v1/external/getSGAudio/${activityRange.aacSegmentFilename}`,
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

const calcHlsDuration = async ({
  endpointName,
}: {
  endpointName: MTXHlsEndpointName;
}): Promise<number> => {
  const indexM3u8Url = `${process.env.VITE_PUBLIC_MEDIA_MTX_HLS_URL}${endpointName}/index.m3u8`;

  // get the m3u8 index
  const indexM3u8Response = await fetch(indexM3u8Url);
  const indexM3u8Text = await indexM3u8Response.text();

  // get the stream m3u8 file from the index
  const indexLines = indexM3u8Text.split("\n");
  let streamM3u8Url = "";
  for (const line of indexLines) {
    if (line.includes(".m3u8")) {
      streamM3u8Url = `${process.env.VITE_PUBLIC_MEDIA_MTX_HLS_URL}${endpointName}/${line.replace(/\n/g, "")}`;
      break;
    }
  }

  // get the m3u8 file
  const m3u8Response = await fetch(streamM3u8Url);

  // parse the m3u8 file
  const m3u8Text = await m3u8Response.text();
  const lines = m3u8Text.split("\n");
  let totalDuration = 0;

  lines.forEach((line) => {
    // Match EXTINF lines
    const extinfMatch = line.match(/^#EXTINF:([\d.]+),/);
    if (extinfMatch) {
      totalDuration += parseFloat(extinfMatch[1]);
    }
  });
  return totalDuration;
};

export const fetchMTXAPIResponses = async ({
  dateWanted,
  source,
  forceNew,
}: {
  dateWanted: string;
  source: Source;
  forceNew: boolean;
}): Promise<WrappedResponse<MTXApiResponses>> => {
  const retriever = async (): Promise<MTXApiResponses> => {
    const sourceAbbr = source === "ISS" ? "ISS" : "TE";

    /**
     * Get the mtxHls endpoints and the duration of hls streams
     */
    const mtxHlsEndpoints: MTXHlsEndpoint[] = [];
    // we hit this to get a list of current live endpoint names from mediamtx
    try {
      const auth = `Basic ${Buffer.from(
        `${process.env.MEDIAMTX_USERNAME}:${process.env.MEDIAMTX_PASSWORD}`
      ).toString("base64")}`;

      const mtxApiBaseUrl = process.env.VITE_PUBLIC_MEDIA_MTX_CONTROL_URL;

      const response = await fetch(`${mtxApiBaseUrl}v3/paths/list`, {
        headers: {
          Authorization: auth,
        },
      });
      const mtxResponceJson = await response.json();
      const itemsArray = mtxResponceJson.items;
      for (const item of itemsArray) {
        const streamNameSuffix = item.name.split("_")[1];

        // if the stream is ready, get the length of the hls stream and add the result to the list of endpoints
        if (item.ready && sourceAbbr === streamNameSuffix) {
          const duration = await calcHlsDuration({ endpointName: item.name });
          mtxHlsEndpoints.push({ name: item.name, secondsAvailable: duration });
        }
      }
    } catch (e) {
      // if the mtxApi is down, return an empty object
      return {
        mtxPlaybackAvailability: {},
        mtxHlsEndpoints: [],
      };
    }

    /**
     * Hit the newly sped up mtxPlayback API to get the recorded playback availability
     */
    const mtxRecordingsBaseUrl = process.env.VITE_PUBLIC_MEDIA_MTX_RECORDINGS_URL;

    // loop through the 8 channels and get the mtxPlayback records for each channel
    const mtxPlaybackAvailability: MTXPlaybackAvailability = {};

    interface MtxRecordingTimeRangeResponse extends MTXRecordingTimeRange {
      url: string;
    }

    for (let channel = 1; channel <= 8; channel++) {
      const mtxPlaybackUrl = `${mtxRecordingsBaseUrl}list?path=DL${channel}_${sourceAbbr}`;
      try {
        const res = await fetchWithTimeout(mtxPlaybackUrl, {}, 20000);
        const rawJson: MtxRecordingTimeRangeResponse[] = await res.json();
        const mtxPlaybackRecords: MTXRecordingTimeRange[] =
          rawJson?.map(({ start, duration }) => ({
            start,
            duration,
          })) || [];

        mtxPlaybackAvailability[channel.toString()] = mtxPlaybackRecords;
      } catch (e) {
        mtxPlaybackAvailability[channel.toString()] = [];
      }
    }

    /**
     * Check all the mtxPlayback records for their start times and duration
     * These playback records can span multiple days, but CODA can only play one day at a time
     * This function modifies the playback ranges to only show the portion of the playback that is available for the current day
     * */

    const dateWantedDate = midnightZulu(new Date(dateWanted));
    const newMtxPlaybackAvailability: MTXPlaybackAvailability = {};

    for (let channel = 1; channel <= 8; channel++) {
      if (!mtxPlaybackAvailability[channel.toString()]) {
        continue;
      }
      const mtxPlaybackRecords = clone(mtxPlaybackAvailability[channel.toString()]);
      const newMtxPlaybackRecords: MTXRecordingTimeRange[] = [];

      for (const mtxPlaybackRecord of mtxPlaybackRecords) {
        // the mtx playback record starts before the beginning of today, check if it ends after the beginning of today
        if (new Date(mtxPlaybackRecord.start).getTime() < dateWantedDate.getTime()) {
          const mtxDLEndDate =
            new Date(mtxPlaybackRecord.start).getTime() + mtxPlaybackRecord.duration * 1000;

          // if the segment ends after the beginning of today, then we use it by making the start time the beginning of today
          // and adjust the duration so it renders properly
          if (mtxDLEndDate > dateWantedDate.getTime()) {
            mtxPlaybackRecord.duration =
              mtxPlaybackRecord.duration -
              (dateWantedDate.getTime() - new Date(mtxPlaybackRecord.start).getTime()) / 1000;

            // if the clip, even with the adjusted start time and duration longer than the current day, then we adjust the duration to be the length of the current day
            if (mtxDLEndDate > dateWantedDate.getTime() + 86400000) {
              mtxPlaybackRecord.duration = 86400;
            }
            mtxPlaybackRecord.start = dateWantedDate.toISOString();
            newMtxPlaybackRecords.push(mtxPlaybackRecord);
          }
        } else {
          // the mtx playback record starts on or after the beginning of today
          newMtxPlaybackRecords.push(mtxPlaybackRecord);
        }
      }
      newMtxPlaybackAvailability[channel.toString()] = newMtxPlaybackRecords;
    }

    return {
      mtxPlaybackAvailability: newMtxPlaybackAvailability,
      mtxHlsEndpoints,
    };
  };

  const res: WrappedResponse<MTXApiResponses> = await fetchWithCache<MTXApiResponses>({
    identifier: `mtxPlaybackAvailability_${source}_${dateWanted}`,
    cacheFolder: "labs/mtxPlayback",
    retriever,
    cacheAge: 120, // 2 minutes.
    forceRetriever: forceNew,
  });

  return { ...res, source: "mtx" };
};
