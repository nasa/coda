/** Uses IO collections `cols`= query param in the IO API as a value. Pulled from the `cid=` in URLs like https://io.jsc.nasa.gov/app/collections.cfm?cid=2359937 */
type Collection =
  | 4 //International Space Station. https://io.jsc.nasa.gov/app/collections.cfm?cid=4
  | 2359932 // All test events https://io.jsc.nasa.gov/app/collections.cfm?cid=2359932
  | 78178 // Neutral Buoyancy Lab. https://io.jsc.nasa.gov/app/collections.cfm?cid=78178
  | 2346894 // Artemis Missions. https://io.jsc.nasa.gov/app/collections.cfm?cid=2346894
  | 2375374; // DA - EVA & Human Surface Mobility Program (Artemis Training). https://io.jsc.nasa.gov/app/collections.cfm?cid=2375374

type IOFetchType = "videos" | "photos";

type Source = "ISS" | "TEST_EVENTS" | "NBL" | "ARTEMIS" | "ARTEMIS_TRAINING";

type MediaMedium = "video" | "photo" | "transcript" | "audio";

type SourceShortVal = 0 | 1 | 2 | 3 | 4;

/** Keys used to lookup and map sequence type values */
type SequenceTypeKey = "EVA" | "IVA" | "testing" | "analog" | "training";

type SequenceType = 1 | 2 | "testing" | "analog" | "training";

/** Keys used to look up short integer values for pane types */
type PaneTypeKey =
  | "empty"
  | "video_downlink"
  | "video_non_downlink"
  | "photo"
  | "event_info"
  | "iss_location"
  | "gps_location"
  | "photo_all"
  | "talkybot"
  | "graph";

/** Pane types converted to integers */

type PaneTypeShortVal = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
