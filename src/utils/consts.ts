export const collection: Record<Source, Collection> = {
  ISS: 4,
  TEST_EVENTS: 2359932,
  NBL: 78178,
  ARTEMIS: 2346894,
};

export const sourceShortVal: Record<Source, SourceShortVal> = {
  ISS: 0,
  TEST_EVENTS: 1,
  NBL: 2,
  ARTEMIS: 3,
};

export const sequenceType: Record<SequenceTypeKey, SequenceType> = {
  EVA: 1,
  IVA: 2,
  testing: "testing",
  analog: "analog",
  training: "training",
};

export const paneTypeShortVal: Record<PaneTypeKey, PaneTypeShortVal> = {
  empty: 0,
  video_downlink: 1,
  video_non_downlink: 2,
  photo: 3,
  event_info: 4,
  iss_location: 5,
  gps_location: 6,
  photo_all: 7,
  talkybot: 8,
  // 9 was sg-audio for some reason --- IGNORE ---
  graph: 10,
  pcd_audio: 11,
};
