import fetchWithTimeout from "utils/fetch-with-timeout";
import leoProfanity from "leo-profanity";
import { getApplicableMediaOverrides } from "server/processing/mediaOverrideResolver";
import { dateFromAppSeconds } from "utils/formatting";
import ConsoleLogger from "utils/logging/consoleLogger";

/**
 * Legacy comm overrides.
 *
 * The comm pane is now a native Talkybot client and fetches live audio/transcripts
 * directly from Talkybot. This module preserves the *legacy* override path: DB-backed
 * media-override records (managed in the admin UI) pointing at historical audio
 * manifests + transcripts for non-ISS events (JETT5, MS1, MS2, ...). Talkybot has no
 * data for these, so CODA merges them in as `override: true` audio files.
 *
 * This processing stays server-side (it needs the CODA DB, profanity filtering, and
 * the manifest hosts aren't CORS-enabled for the browser). It is exposed to the
 * client via GET /api/v1/external/comm-overrides (see routes/external/commOverrides.ts),
 * which the direct Talkybot client merges into the talkybot Redux slice.
 */

/** Legacy audio manifest format from override sources */
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

/** Legacy transcript format: [startTimeSecs, speaker, text] */
type LegacyTranscriptEntry = [number, string, string];

/**
 * Returns the legacy override audio files for a given (source, date), or an empty list
 * when there are no overrides. ISS never has overrides (Talkybot covers it).
 */
export default async function getCommOverrides({
  source,
  dateWanted,
}: {
  source: Source;
  dateWanted: string; // yyyy-mm-dd
}): Promise<FetchResponse<TbAudioFileConverted[]>> {
  const emptyResponse: FetchResponse<TbAudioFileConverted[]> = {
    data: [],
    fetchMetadata: { success: true, timestamp: new Date().toISOString() },
    origin: "override",
  };

  if (source === "ISS") {
    return emptyResponse;
  }

  try {
    const [audioMediaOverrides, transcriptMediaOverrides] = await Promise.all([
      getApplicableMediaOverrides({
        source,
        type: "audio",
        requestedDate: dateWanted,
        visibility: "public",
      }),
      getApplicableMediaOverrides({
        source,
        type: "transcript",
        requestedDate: dateWanted,
        visibility: "public",
      }),
    ]);
    const audioMediaOverride = audioMediaOverrides[0];
    const transcriptMediaOverride = transcriptMediaOverrides[0];

    if (audioMediaOverride || transcriptMediaOverride) {
      const audioFiles = await fetchAndMergeLegacyOverrides({
        audioOverrideUrl: audioMediaOverride?.url,
        transcriptOverrideUrl: transcriptMediaOverride?.url,
        dateWanted,
      });

      return {
        data: audioFiles,
        fetchMetadata: { success: true, timestamp: new Date().toISOString() },
        origin: "override",
      };
    }
  } catch (e) {
    // don't block results if media overrides call fails
    ConsoleLogger.warn("Error fetching media overrides:", e);
  }

  return emptyResponse;
}

/**
 * Fetches legacy audio manifest and transcript overrides for events like JETT5, MS1, MS2,
 * and merges them into the TbAudioFileConverted[] format the comm pane renders.
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
