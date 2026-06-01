type PcdAudioRecording = {
  nasa_id: string;
  title: string;
  device: string;
  collectionPath: string;
  startTime: string | null;
  durationSeconds: number | null;
  endTime: string | null;
  audioUrl: string;
  infoUrl: string;
};

type PcdAudioSourceCollection = {
  cid: number;
  label: string;
  description: string;
  url: string;
};

type PcdAudioStats = {
  total: number;
  withAudio: number;
  skippedNoAudio: number;
  restricted: number;
  deduplicated: number;
  output: number;
  probeLocal: number;
  probeDownload: number;
  probeFailed: number;
};

type PcdAudioJson = {
  generatedAt: string;
  sourceCollections: PcdAudioSourceCollection[];
  stats: PcdAudioStats;
  timingNote: string;
  recordings: PcdAudioRecording[];
};

type PcdAudioRecord = {
  id: number;
  source: Source;
  notes?: string;
  audioJson: PcdAudioJson;
};

type PcdAudioUpsertRequest = {
  id?: number;
  source: Source;
  notes?: string;
  audioJson: PcdAudioJson;
};

type PcdAudioListItem = {
  id: number;
  source: Source;
  notes?: string;
  generatedAt: string;
  recordingCount: number;
  /** Earliest recording date (YYYY-MM-DD), null if no dated recordings */
  dateStart: string | null;
  /** Latest recording date (YYYY-MM-DD), null if no dated recordings */
  dateEnd: string | null;
};
