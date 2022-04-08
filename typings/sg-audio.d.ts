type SgActivityRangeRecord = {
  sound_start_secs: number;
  sound_stop_secs: number;
  aacSegmentFilename: string;
};

type SgChannelRecord = {
  sgChannel: number;
  activity_ranges: SgActivityRangeRecord[];
};

type SgVideoRecord = {
  nasa_id: string;
  duration_seconds: number;
  start_seconds: number;
  cue_start_seconds: number;
  cue_end_seconds: number;
  sgChannels: SgChannelRecord[];
};
