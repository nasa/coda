/**
 * API response types from Talkybot on the coda API endpoint.
 * Only includes fields needed for audio playback and transcript display.
 */

interface TbAudioFile {
  fileUuid: string;
  startTime: Date;
  appSeconds?: number;
  duration: number;
  channel: string; // channel slug (e.g. "sg1")
  text: string;
  language: string;

  /** Indicates this is from an override source, not Talkybot API */
  override?: boolean;
  /** Full URL to download audio file (used for overrides since they're not from Talkybot API) */
  audioUrl?: string;
}

interface TbDateResponse {
  date: string; // ISO date format (YYYY-MM-DD)
  audioFiles: TbAudioFile[];
}
