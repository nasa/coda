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

export enum SequenceType {
  EVA = 1,
  IVA,
  testing,
  analog,
  training,
}
