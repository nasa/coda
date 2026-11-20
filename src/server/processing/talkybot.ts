import fetchWithTimeout from "utils/fetch-with-timeout";
import leoProfanity from "leo-profanity";
import { getApplicableMediaOverrides } from "server/processing/mediaOverrideResolver";
import { dateFromAppSeconds } from "utils/formatting";
import ConsoleLogger from "utils/logging/consoleLogger";

/**
 * Response type for Talkybot data fetch
 */
export type TalkybotResponse = TbAudioFileConverted[];

/**
 * Legacy audio manifest format from override sources
 */
interface LegacyAudioManifest {
  start_seconds: number;
  cue_start_seconds: number;
  cue_end_seconds: number;
  sgChannels: LegacySgChannel[];
}

interface LegacySgChannel {
  sgChannel: number;
  activity_ranges: LegacyActivityRange[];
}

interface LegacyActivityRange {
  sound_start_secs: number;
  sound_stop_secs: number;
  aacSegmentFilename: string;
}

/**
 * Converts an TbAudioFileNative entity to TbAudioFileConverted format.
 * Expects channel to be populated; transcription is optional.
 * Duration is calculated from mediaInfo if available, otherwise from transcription segments (defaults to 0).
 */
export const toTbAudioFileConverted = (af: TbAudioFileNative): TbAudioFileConverted => {
  // Calculate duration from mediaInfo, or fall back to last segment's end time, default 0
  const duration =
    af.mediaInfo?.duration ??
    (af.transcription?.segments.length
      ? Math.max(...af.transcription.segments.map((s) => s.end))
      : 0);

  const text =
    af.transcription?.text ??
    af.transcription?.segments.map((segment) => segment.text).join(" ") ??
    "";
  const textOriginalLanguage =
    af.transcription?.nativeLanguageText ??
    af.transcription?.nativeLanguageSegments?.map((segment) => segment.text).join(" ") ??
    "";

  const startTime = /(?:Z|[+-]\d{2}:\d{2})$/.test(af.startTime)
    ? new Date(af.startTime)
    : new Date(`${af.startTime}Z`);

  return {
    fileUuid: af.uuid,
    startTime,
    duration,
    channel: af.channel.slug,
    talkybotChannelId: af.channel.id,
    restricted: !af.channel.public || !af.channel.enabled,
    text,
    textOriginalLanguage,
    language: af.transcription?.language ?? "",
    groups: af.channel.groups ?? [],
  };
};

/**
 * Legacy transcript format: [startTimeSecs, speaker, text]
 */
type LegacyTranscriptEntry = [number, string, string];

/** Match the sim and group predicates used by Talkybot's internal daily transcript API. */
export const getTalkybotSources = (channel: TbAudioFileNative["channel"]): Source[] => {
  if (channel.sim) return ["TEST_EVENTS"];

  const sources: Source[] = [];
  if (channel.groups?.some(({ slug }) => slug === "iss")) sources.push("ISS");
  if (channel.groups?.some(({ slug }) => slug === "artemis")) sources.push("ARTEMIS");
  return sources;
};

async function fetchTalkybotHistory(date: string): Promise<TbDateResponse> {
  const token = process.env.EMSS_TOKEN;
  const baseUrl = process.env.VITE_PUBLIC_TALKYBOT_URL;
  if (!token || !baseUrl) throw new Error("Talkybot server connection is not configured");
  const url = new URL("/api/v1/external/audiofiles", baseUrl);
  url.searchParams.set("date", date);
  url.searchParams.set("includeRestricted", "true");
  const response = await fetchWithTimeout(url.href, {
    headers: { "x-api-key": token },
    redirect: "error",
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Talkybot history returned ${response.status}`);
  }
  const data: TbDateResponse = await response.json();
  if (!Array.isArray(data.audioFiles)) {
    throw new Error("Talkybot history did not include clips");
  }
  return data;
}

async function getLegacyOverrides(source: Source, dateWanted: string): Promise<TalkybotResponse> {
  if (source === "ISS") return [];
  const [audio, transcript] = await Promise.all(
    (["audio", "transcript"] as const).map((type) =>
      getApplicableMediaOverrides({ source, type, requestedDate: dateWanted, visibility: "public" })
    )
  );
  if (!audio.length && !transcript.length) return [];

  return fetchAndMergeLegacyOverrides({
    audioOverrideUrl: audio[0]?.url,
    transcriptOverrideUrl: transcript[0]?.url,
    dateWanted,
  });
}

export async function getTalkybotData(
  source: Source,
  date: string,
  channelIds: ReadonlySet<number> | null
): Promise<FetchResponse<TalkybotResponse>> {
  const [history, overrides] = await Promise.allSettled([
    channelIds?.size
      ? fetchTalkybotHistory(date).then(({ audioFiles }) =>
          audioFiles
            .filter(
              (file) =>
                !file.deleted &&
                channelIds.has(file.channel.id) &&
                getTalkybotSources(file.channel).includes(source)
            )
            .map(toTbAudioFileConverted)
        )
      : Promise.resolve([]),
    getLegacyOverrides(source, date),
  ]);
  const error =
    !channelIds || history.status === "rejected" ? "Unable to load Talkybot communications." : null;
  if (history.status === "rejected") ConsoleLogger.warn("Talkybot history:", history.reason);
  if (overrides.status === "rejected") ConsoleLogger.warn("Comm overrides:", overrides.reason);

  const nativeFiles = history.status === "fulfilled" ? history.value : [];
  const legacyFiles = overrides.status === "fulfilled" ? overrides.value : [];
  return {
    data: [...nativeFiles, ...legacyFiles].sort((a, b) => +a.startTime - +b.startTime),
    fetchMetadata: {
      success: !error,
      timestamp: new Date().toISOString(),
      ...(error && { error }),
    },
    origin: nativeFiles.length || !legacyFiles.length ? "talky-bot" : "override",
  };
}

/**
 * Fetches legacy audio manifest and transcript overrides for events like JETT5, MS1, MS2, and merges them
 * into the new TbAudioFile[] format compatible with Talkybot API response.
 * TODO: Decide on architecture for true Talkybot compatible overrides and how to store them on labs, etc.
 */
async function fetchAndMergeLegacyOverrides({
  audioOverrideUrl,
  transcriptOverrideUrl,
  dateWanted,
}: {
  audioOverrideUrl?: string;
  transcriptOverrideUrl?: string;
  dateWanted: string;
}): Promise<TbAudioFileConverted[]> {
  // Fetch legacy audio manifest
  let legacyManifest: LegacyAudioManifest[] = [];
  if (audioOverrideUrl) {
    try {
      const res = await fetchWithTimeout(`${audioOverrideUrl}/audioManifest.json`);
      legacyManifest = (await res.json()) as LegacyAudioManifest[];
    } catch (e) {
      ConsoleLogger.warn("Error fetching audio manifest override:", e);
    }
  }

  // Fetch legacy transcripts for all channels
  const legacyTranscripts: Map<number, LegacyTranscriptEntry[]> = new Map();
  if (transcriptOverrideUrl) {
    leoProfanity.loadDictionary("en");
    for (let channelNum = 1; channelNum <= 4; channelNum++) {
      try {
        const res = await fetchWithTimeout(
          `${transcriptOverrideUrl}/transcript-SG${channelNum}.json`
        );
        const transcriptEntries = (await res.json()) as LegacyTranscriptEntry[];
        // Filter bad words
        transcriptEntries.forEach((entry) => {
          entry[2] = leoProfanity.clean(entry[2]);
        });
        legacyTranscripts.set(channelNum, transcriptEntries);
      } catch (e) {
        // Channel transcript not found, skip
      }
    }
  }

  const audioFiles: TbAudioFileConverted[] = [];

  // If we have audio manifest, merge with transcripts
  if (legacyManifest.length > 0) {
    for (const manifest of legacyManifest) {
      for (const sgChannel of manifest.sgChannels) {
        const channelNum = sgChannel.sgChannel;
        const channelTranscripts = legacyTranscripts.get(channelNum) || [];

        for (const activityRange of sgChannel.activity_ranges) {
          const startAppSeconds = activityRange.sound_start_secs + manifest.start_seconds;
          const stopAppSeconds = activityRange.sound_stop_secs + manifest.start_seconds;
          const durationSecs = stopAppSeconds - startAppSeconds;

          // Find matching transcript entries for this audio segment's time range (appSeconds)
          const matchingTranscripts = channelTranscripts.filter(
            (entry) => entry[0] >= startAppSeconds && entry[0] < stopAppSeconds
          );

          // Combine all transcript text
          const fullText = matchingTranscripts.map((entry) => entry[2]).join(" ");

          // Create AudioFile in Coda-compatible format
          const audioFile: TbAudioFileConverted = {
            fileUuid: `override-${dateWanted}-ch${channelNum}-${startAppSeconds}`, // not used for anything. overrides use the audioUrl
            startTime: dateFromAppSeconds(startAppSeconds, dateWanted),
            duration: durationSecs,
            channel: `sg${channelNum}`,
            text: fullText || "",
            textOriginalLanguage: "",
            language: "en",
            groups: [],
            override: true,
            audioUrl: `${audioOverrideUrl}/audio/${activityRange.aacSegmentFilename}`,
          };

          audioFiles.push(audioFile);
        }
      }
    }
  } else if (legacyTranscripts.size > 0) {
    // No audio manifest, but we have transcripts - create AudioFile entries from transcripts only
    for (const [channelNum, transcriptEntries] of legacyTranscripts) {
      for (const entry of transcriptEntries) {
        const startAppSeconds = entry[0];
        const text = entry[2];

        const audioFile: TbAudioFileConverted = {
          fileUuid: `override-${dateWanted}-ch${channelNum}-${startAppSeconds}`, // not used for anything. overrides use the audioUrl
          startTime: dateFromAppSeconds(startAppSeconds, dateWanted),
          duration: 0,
          channel: `sg${channelNum}`,
          text,
          textOriginalLanguage: "",
          language: "en",
          groups: [],
          override: true,
          audioUrl: undefined,
        };

        audioFiles.push(audioFile);
      }
    }
  }

  // Sort by start time
  audioFiles.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return audioFiles;
}
