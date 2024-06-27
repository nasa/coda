export const collection = {
  ISS: 4 as Collection,
  TEST_EVENTS: 2359932 as Collection,
  NBL: 78178 as Collection,
  ARTEMIS: 2346894 as Collection,
};

export const sourceShortVal = {
  ISS: 0 as SourceShortVal,
  TEST_EVENTS: 1 as SourceShortVal,
  NBL: 2 as SourceShortVal,
  ARTEMIS: 3 as SourceShortVal,
};

export const sequenceType = {
  EVA: 1 as SequenceType,
  IVA: 2 as SequenceType,
  testing: "testing" as SequenceType,
  analog: "analog" as SequenceType,
  training: "training" as SequenceType,
};

export const paneTypeShortVal = {
  empty: 0 as PaneTypeShortVal,
  video_downlink: 1 as PaneTypeShortVal,
  video_non_downlink: 2 as PaneTypeShortVal,
  photo: 3 as PaneTypeShortVal,
  event_info: 4 as PaneTypeShortVal,
  iss_location: 5 as PaneTypeShortVal,
  gps_location: 6 as PaneTypeShortVal,
  photo_all: 7 as PaneTypeShortVal,
  transcript: 8 as PaneTypeShortVal,
  sgAudio: 9 as PaneTypeShortVal,
  graph: 10 as PaneTypeShortVal,
};
