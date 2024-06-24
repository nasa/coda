// These 3 types are what labs returns
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

// used by CODA to allow for each audio clip to come from a different source (when mixing labs audio and talkybot audio)
type SgActivityRangeFullUrlRecord = {
  sound_start_secs: number;
  sound_stop_secs: number;
  aacSegmentFullUrl: string;
};

type SgActivityFullUrlRecord = {
  override: boolean;
  sgActivityRangeFullUrlRecords: SgActivityRangeFullUrlRecord[][]; // 4 channels
};

type SgActivityRecord = {
  baseUrl: string;
  override: boolean;
  sgActivityRecord: SgActivityRecord[][];
};
