/**
 * API response types from Talkybot on the coda API endpoint.
 * Only includes fields needed for audio playback and transcript display.
 */

interface TbAudioFileConverted {
  fileUuid: string;
  startTime: Date;
  appSeconds?: number;
  duration: number;
  channel: string; // channel slug (e.g. "sg1")
  text: string;
  textOriginalLanguage: string;
  language: string;

  /** Indicates this is from an override source, not Talkybot API */
  override?: boolean;
  /** Full URL to download audio file (used for overrides since they're not from Talkybot API) */
  audioUrl?: string;
}

interface TbDateResponse {
  date: string; // ISO date format (YYYY-MM-DD)
  audioFiles: TbAudioFileNative[];
}

interface TbAudioFileNative {
  uuid: string;
  version: number;
  added: string; // ISO datetime string
  updated: string; // ISO datetime string
  startTime: string; // ISO datetime string
  deleted: boolean;
  size?: number | null;
  relativePath?: string | null;

  channel: {
    id: number;
    name: string;
    slug: string;
    enabled?: boolean;
    sim?: boolean;
    public?: boolean;
    dicesId?: number | null;
  };

  transcription?: {
    uuid: string;
    requested: string; // ISO datetime string
    received: string; // ISO datetime string
    updated: string; // ISO datetime string
    transcriptionOptions?: {
      model?: string | null;
      prompt?: string | null;
      hotwords?: string[] | null;
      temperature?: number | null;
      align?: boolean | null;
      diarize?: boolean | null;
    } | null;
    language: string;
    aligned: boolean;
    diarized: boolean;
    translated: boolean;
    segments: Array<
      | { type: "segment"; start: number; end: number; text: string }
      | { type: "diarized"; start: number; end: number; text: string; speaker: string }
    >;
    nativeLanguageSegments?: Array<
      | { type: "segment"; start: number; end: number; text: string }
      | { type: "diarized"; start: number; end: number; text: string; speaker: string }
    > | null;
    text: string;
    nativeLanguageText?: string;
  } | null;

  mediaInfo?: {
    codec: string;
    profile?: string | null;
    sampleRate: number;
    sampleFormat: string;
    bitRate: number;
    channels: number;
    channelLayout?: string | null;
    duration: number;
  } | null;
}
