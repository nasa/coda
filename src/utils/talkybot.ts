/**
 * Client-side Talkybot helpers.
 *
 * CODA's comm pane is a *native Talkybot client*: the browser talks directly to a
 * Talkybot server (Socket.IO + REST) using the shared `.fit.nasa.gov` auth cookie.
 * These helpers convert Talkybot's native audio-file shape into the
 * `TbAudioFileConverted` the comm pane renders, and filter that data down to the
 * CODA source the pane is showing. (This logic previously lived server-side in
 * src/server/processing/talkybot.ts when ingestion went through the S2S socket.)
 */

import { getSourcesForTalkybotGroup } from "utils/sourceDataTypeMap";

/**
 * Base URL of the Talkybot server the browser connects to directly. Baked in at
 * build time via VITE_PUBLIC_TALKYBOT_URL (see docker/nginx/Dockerfile). Any
 * trailing slash is stripped so callers can append `/api/v1/...` cleanly.
 */
export const getTalkybotBaseUrl = (): string => {
  const url = import.meta.env.VITE_PUBLIC_TALKYBOT_URL as string | undefined;
  return (url ?? "").replace(/\/+$/, "");
};

/** Per-user authenticated URL for an audio file's binary, served directly by Talkybot. */
export const getTalkybotAudioUrl = (fileUuid: string): string =>
  `${getTalkybotBaseUrl()}/api/v1/audiofiles/${fileUuid}/file`;

/** HTTP local development cannot use Talkybot's shared, same-site HTTPS session. */
export const getTalkybotSetupError = (pageUrl: string): string | null => {
  const baseUrl = getTalkybotBaseUrl();
  if (!baseUrl || new URL(baseUrl).protocol !== "https:") return null;
  const page = new URL(pageUrl);
  if (page.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(page.hostname)) {
    return "Open CODA over HTTPS at coda-local.fit.nasa.gov to connect to Talkybot.";
  }
  return null;
};

/** Load both simulation buckets using the browser's real Talkybot session. */
export const fetchTalkybotTranscript = async (
  date: string,
  signal?: AbortSignal
): Promise<TbAudioFileNative[]> => {
  const baseUrl = getTalkybotBaseUrl();
  if (!baseUrl) throw new Error("Talkybot URL is not configured");

  const buckets = await Promise.all(
    [false, true].map(async (sim) => {
      const response = await fetch(`${baseUrl}/api/v1/transcript/${date}?sim=${sim}`, {
        credentials: "include",
        redirect: "error",
        signal,
      });
      if (!response.ok) throw new Error(`Talkybot returned HTTP ${response.status}`);
      const body = (await response.json()) as TbDateResponse;
      if (!Array.isArray(body.audioFiles)) throw new Error("Invalid Talkybot transcript response");
      return body.audioFiles;
    })
  );
  return buckets.flat();
};

/**
 * Convert a Talkybot native audio file (channel + transcription + mediaInfo) into the
 * `TbAudioFileConverted` shape the comm pane renders.
 *
 * Duration comes from mediaInfo when present, otherwise the last transcription
 * segment's end time (default 0). Transcript text is the concatenation of
 * "segment"-type entries; the original-language text comes from
 * nativeLanguageSegments when the utterance was translated.
 */
export const toTbAudioFileConverted = (af: TbAudioFileNative): TbAudioFileConverted => {
  const duration =
    af.mediaInfo?.duration ??
    (af.transcription?.segments.length
      ? Math.max(...af.transcription.segments.map((s) => s.end))
      : 0);

  const text =
    af.transcription?.segments
      .filter((s) => s.type === "segment")
      .map((s) => s.text)
      .join(" ") ?? "";

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
 * Keep only the audio files that route to the given CODA source. A file is included
 * if any of its channel groups resolves (together with the channel's sim flag) to a
 * set of sources containing `source`. Files with no group info are included
 * (backward compatible). Notably sim-ISS resolves to no sources and is dropped.
 * See getSourcesForTalkybotGroup in utils/sourceDataTypeMap.ts.
 */
export const filterAudioFilesForSource = (
  files: TbAudioFileConverted[],
  source: Source
): TbAudioFileConverted[] =>
  files.filter((af) => {
    if (af.groups.length === 0) return true;
    return af.groups.some((g) => getSourcesForTalkybotGroup(g.slug, af.sim).includes(source));
  });
