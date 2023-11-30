/** Enum that uses IO collections `cols`= query param in the IO API as a value. Pulled from the `cid=` in URLs like https://io.jsc.nasa.gov/app/collections.cfm?cid=2359937 */
export enum Collection {
  /** International Space Station. https://io.jsc.nasa.gov/app/collections.cfm?cid=4 */
  ISS = 4,
  /** All test events https://io.jsc.nasa.gov/app/collections.cfm?cid=2359932 */
  TEST_EVENTS = 2359932,
  /** Neutral Buoyancy Lab. https://io.jsc.nasa.gov/app/collections.cfm?cid=78178 */
  NBL = 78178,
  /** Artemis Missions. https://io.jsc.nasa.gov/app/collections.cfm?cid=2346894 */
  ARTEMIS = 2346894,
}

export enum IOFetchType {
  VIDEOS = "videos",
  PHOTOS = "photos",
}

export enum LoadingStatusEnum {
  LOADING = "loading",
  LOADED = "loaded",
  UNNEEDED = "unneeded",
}

export enum Source {
  ISS = "ISS",
  TEST_EVENTS = "TEST_EVENTS",
  NBL = "NBL",
  ARTEMIS = "ARTEMIS",
}

export enum SourceShortVal {
  ISS = 0,
  TEST_EVENTS = 1,
  NBL = 2,
  ARTEMIS = 3,
}

export enum SequenceType {
  EVA = 1,
  IVA,
  testing,
  analog,
  training,
}

/**
 * Pane types converted to integers
 */
export enum PaneTypeShortVal {
  empty = 0,
  video_downlink = 1,
  video_non_downlink = 2,
  photo = 3,
  event_info = 4,
  iss_location = 5,
  gps_location = 6,
  photo_all = 7,
  transcript = 8,
  sgAudio = 9,
  graph = 10,
}

/**
 * Conatins all the possible subfolders for the cache.
 * This enum is iterated through when clearing the entire cache
 */
export enum CacheFolder {
  Celestrak = "celestrak",
  Spacetrack = "spacetrack",
  Daynight_topo = "daynight/topo",
  Daynight_issLocation = "daynight/issLocation",
  Io = "io",
  Wiki = "wiki",
  Wiki_all = "wiki/all",
  Wiki_gps = "wiki/gps",
  test = "test",
}
