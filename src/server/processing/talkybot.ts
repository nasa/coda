import fetchWithTimeout from "utils/fetch-with-timeout";
import leoProfanity from "leo-profanity";
import { getPublicMediaOverridesList } from "server/express/routes/db/mediaOverrides";
import { dateFromAppSeconds } from "utils/formatting";
import ConsoleLogger from "utils/logging/consoleLogger";
import { getSourcesWithDataType, getSourcesForTalkybotGroup } from "utils/sourceDataTypeMap";

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

  // Concatenate text from segments of type "segment"
  const text =
    af.transcription?.segments
      .filter((s) => s.type === "segment")
      .map((s) => s.text)
      .join(" ") ?? "";

  // Concatenate text from nativeLanguageSegments if available
  const textOriginalLanguage =
    af.transcription?.nativeLanguageSegments
      ?.filter((s) => s.type === "segment")
      .map((s) => s.text)
      .join(" ") ?? "";

  return {
    fileUuid: af.uuid,
    startTime: new Date(
      typeof af.startTime === "string"
        ? af.startTime.endsWith("Z")
          ? af.startTime
          : `${af.startTime}Z`
        : af.startTime
    ),
    duration,
    channel: af.channel.slug,
    text,
    textOriginalLanguage,
    language: af.transcription?.language ?? "",
    groups: af.channel.groups ?? [],
    sim: af.channel.sim ?? false,
  };
};

/**
 * Legacy transcript format: [startTimeSecs, speaker, text]
 */
type LegacyTranscriptEntry = [number, string, string];

/**
 * Fetches Talkybot audio and transcript data for a given date.
 * The new Talkybot API returns audio files with embedded transcriptions.
 * For non-ISS sources, legacy overrides are fetched and converted to AudioFile format.
 */
export default async function getTalkybotData({
  source,
  dateWanted,
}: {
  source: Source;
  dateWanted: string; // yyyy-mm-dd
}): Promise<FetchResponse<TalkybotResponse>> {
  const requestedDate = new Date(dateWanted);

  // Fetch source overrides from the database for this date (only for non-ISS sources)
  if (source !== "ISS") {
    try {
      const mediaOverrides = await getPublicMediaOverridesList();

      // Check for audio override
      const audioMediaOverride = mediaOverrides?.find((vo) => {
        const overrideDate = new Date(vo.date);
        return (
          overrideDate.getTime() === requestedDate.getTime() &&
          vo.source === source &&
          vo.type === "audio"
        );
      });

      // Check for transcript override
      const transcriptMediaOverride = mediaOverrides?.find((vo) => {
        const overrideDate = new Date(vo.date);
        return (
          overrideDate.getTime() === requestedDate.getTime() &&
          vo.source === source &&
          vo.type === "transcript"
        );
      });

      // If we have overrides, merge them into AudioFile format
      if (audioMediaOverride || transcriptMediaOverride) {
        const audioFiles = await fetchAndMergeLegacyOverrides({
          audioOverrideUrl: audioMediaOverride?.url,
          transcriptOverrideUrl: transcriptMediaOverride?.url,
          dateWanted,
        });

        return {
          data: audioFiles,
          fetchMetadata: {
            success: true,
            timestamp: new Date().toISOString(),
          },
          origin: "override",
        };
      }
    } catch (e) {
      // don't block results if media overrides call fails
      ConsoleLogger.warn("Error fetching media overrides:", e);
    }
  }

  // Fetch Talkybot's native, combined audio/transcript data from Talkybot
  const nativeAudioFiles = await fetchTalkybotAudioFiles({
    source,
    dateWanted,
  });

  // Convert native audio files to the format expected by the UI
  const allAudioFiles = nativeAudioFiles.map(toTbAudioFileConverted);

  // Filter by group + sim flag: include the file if any of its groups resolves to a
  // set of CODA sources that contains the requested source. The (group, sim) pair
  // together determines routing (see getSourcesForTalkybotGroup) - notably, a
  // sim:true file in the ISS group is never routed anywhere, since CODA never shows
  // simulated ISS traffic. Unknown slugs fall through to the miscellaneous bucket
  // inside that helper, so we never silently drop unmapped content.
  const audioFiles = allAudioFiles.filter((af) => {
    if (af.groups.length === 0) return true; // No group info = include (backward compatible with REST API)
    return af.groups.some((g) => getSourcesForTalkybotGroup(g.slug, af.sim).includes(source));
  });

  return {
    data: audioFiles,
    fetchMetadata: {
      success: true,
      timestamp: new Date().toISOString(),
    },
    origin: "talky-bot",
  };
}

/**
 * Fetches audio files from Talkybot API.
 * Returns TbAudioFile[] which includes channel info and transcriptions.
 * Supports sources defined in SOURCE_DATA_TYPE_MAP with "talkybot" data type.
 */
export async function fetchTalkybotAudioFiles({
  source,
  dateWanted,
}: {
  source: Source;
  dateWanted: string;
}): Promise<TbAudioFileNative[]> {
  // Only sources with talkybot support are valid
  if (!getSourcesWithDataType("talkybot").includes(source)) {
    return [];
  }

  const emssToken = process.env.EMSS_TOKEN;
  if (!emssToken) {
    ConsoleLogger.error("EMSS_TOKEN environment variable is not set");
    return [];
  }

  // Use the /all endpoint so we receive both public and non-public (restricted)
  // channels. Talkybot's /audiofiles endpoint applies a public-only filter and would
  // omit e.g. all artemis/sim training-event audio. CODA is responsible for any
  // downstream per-user gating; for now we ingest everything and route by (group, sim)
  // via getSourcesForTalkybotGroup.
  const url = `${process.env.VITE_PUBLIC_TALKYBOT_URL}/api/v1/external/audiofiles/all?date=${dateWanted}`;

  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "x-api-key": emssToken, // "x-api-key" is required by Talkybot API
      },
    });
    if (!res.ok) {
      ConsoleLogger.error(`Failed to fetch Talkybot audio files: ${res.status} ${res.statusText}`);
      return [];
    }

    const data: TbDateResponse = await res.json();
    ConsoleLogger.debug(
      `talkybot Successfully fetched ${data.audioFiles.length} Talkybot audio files for ${dateWanted}`
    );
    return data.audioFiles;
  } catch (e) {
    ConsoleLogger.error("Error fetching Talkybot audio files:", e);
    return [];
  }
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
            sim: false, // legacy overrides aren't talkybot channels; sim flag isn't meaningful
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
          sim: false, // legacy overrides aren't talkybot channels; sim flag isn't meaningful
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
