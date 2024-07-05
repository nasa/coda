/** Uses IO collections `cols`= query param in the IO API as a value. Pulled from the `cid=` in URLs like https://io.jsc.nasa.gov/app/collections.cfm?cid=2359937 */
type Collection =
  | 4 //International Space Station. https://io.jsc.nasa.gov/app/collections.cfm?cid=4
  | 2359932 // All test events https://io.jsc.nasa.gov/app/collections.cfm?cid=2359932
  | 78178 // Neutral Buoyancy Lab. https://io.jsc.nasa.gov/app/collections.cfm?cid=78178
  | 2346894; // Artemis Missions. https://io.jsc.nasa.gov/app/collections.cfm?cid=2346894

type IOFetchType = "videos" | "photos";

type LoadingStatus = "loading" | "loaded" | "unneeded";

type Source = "ISS" | "TEST_EVENTS" | "NBL" | "ARTEMIS";

type SourceShortVal = 0 | 1 | 2 | 3;

type SequenceType = 1 | 2 | "testing" | "analog" | "training";

/**
 * Pane types converted to integers
 */
type PaneTypeShortVal = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * Contains all the possible subfolders for the cache.
 * This type is iterated through when clearing the entire cache
 */
type CacheFolder =
  | "celestrak"
  | "spacetrack"
  | "daynight/topo"
  | "daynight/issLocation"
  | "io"
  | "labs/transcripts"
  | "labs/audio"
  | "media"
  | "wiki"
  | "wiki/all"
  | "wiki/gps"
  | "test";
