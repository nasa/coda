import fetchWithTimeout from "utils/fetch-with-timeout";
import leoProfanity from "leo-profanity";
import { getMediaOverridesList } from "server/express/routes/db/mediaOverrides";
import { dateFromAppSeconds } from "utils/formatting";
import ConsoleLogger from "utils/logging/consoleLogger";

/**
 * Response type for Talkybot data fetch
 */
export interface TalkybotResponse {
  audioFiles: TbAudioFile[];
}

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
      const mediaOverrides = await getMediaOverridesList();

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
          data: {
            audioFiles,
          },
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
  const audioFiles = await fetchTalkybotAudioFiles({
    source,
    dateWanted,
  });

  return {
    data: {
      audioFiles,
    },
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
 * Only returns data for ISS source.
 */
export async function fetchTalkybotAudioFiles({
  source,
  dateWanted,
}: {
  source: Source;
  dateWanted: string;
}): Promise<TbAudioFile[]> {
  // Only ISS source is supported
  if (source !== "ISS") {
    return [];
  }

  const emssToken = process.env.EMSS_TOKEN;
  if (!emssToken) {
    ConsoleLogger.error("EMSS_TOKEN environment variable is not set");
    return [];
  }

  const url = `${process.env.VITE_PUBLIC_TALKYBOT_URL}/api/v1/external/coda/${dateWanted}`;

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
}): Promise<TbAudioFile[]> {
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

  const audioFiles: TbAudioFile[] = [];

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
          const audioFile: TbAudioFile = {
            fileUuid: `override-${dateWanted}-ch${channelNum}-${startAppSeconds}`, // not used for anything. overrides use the audioUrl
            startTime: dateFromAppSeconds(startAppSeconds, dateWanted),
            duration: durationSecs,
            channel: `sg${channelNum}`,
            text: fullText ? fullText : "",
            language: "en",
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

        const audioFile: TbAudioFile = {
          fileUuid: `override-${dateWanted}-ch${channelNum}-${startAppSeconds}`, // not used for anything. overrides use the audioUrl
          startTime: dateFromAppSeconds(startAppSeconds, dateWanted),
          duration: 0,
          channel: `sg${channelNum}`,
          text,
          language: "en",
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
