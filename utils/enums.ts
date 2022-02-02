/** Enum that uses IO collections `cols`= query param in the IO API as a value. Pulled from the `cid=` in URLs like https://io.jsc.nasa.gov/app/collections.cfm?cid=2359937 */
export enum Collection {
  /** International Space Station. https://io.jsc.nasa.gov/app/collections.cfm?cid=4 */
  ISS = 4,
  /** All test events https://io.jsc.nasa.gov/app/collections.cfm?cid=2359932 */
  TEST_EVENTS = 2359932,
  /** Neutral Buoyancy Lab. https://io.jsc.nasa.gov/app/collections.cfm?cid=78178 */
  NBL = 78178,
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
  iss_position = 5,
  test_event_position = 6,
}
