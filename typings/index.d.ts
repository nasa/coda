declare global {
  namespace jest {
    interface Matchers<R> {
      /**
       * Tests that two Dates are within 1 second of each other
       */
      toHappenAround(expected: Date, message?: string): R;
    }
  }
}

/**
 * Response from a search on Imagery Online
 */
export interface IOResponse {
  results: {
    responseheader: any;
    facet_counts: any;
    response: {
      start: number;
      /** Info about videos from the search */
      docs: Doc[];
      numfound: number;
    };
  };
}

/** The base type for all responses from the CODA API */
export interface WrappedResponse<T> {
  data?: T;
  cacheRead?: boolean;
  cacheWrite?: boolean;
  isCache?: boolean;
  error?: string;
  mocked?: boolean;
}

/** A large contiguous section of the timeline representing an event at a location, eg. an EVA on ISS */
export interface Sequence {
  /** The mission associated with this sequence */
  location: Collection;
  /** Broad category of this sequence */
  type: SequenceType;
  /** Short identifier, eg. `US EVA 55` */
  name: string;
  /** Descriptive title, eg. `US EVA IDA3 Install` */
  displayTitle: string;
  /** Where users can get more information */
  dataURL: string;
  /** HH:MM UTC */
  startTime?: string;
  /** YYYY-MM-DD UTC */
  startDate: string;
  /** YYYY-MM-DD UTC */
  endDate?: string;
  /** seconds */
  duration: number;
  /** People responsible for this sequence */
  crew?: Crew;
  /** List of activities performed by crew */
  asPerformed: { [key: Crew]: Activity[] };
  /** List of planned activities for the crew */
  asPlanned?: { [key: Crew]: Activity[] };
}

export enum SequenceType {
  EVA = 1,
  IVA,
  testing,
  analog,
  training,
}

/** Crew names keyed by actor, eg. `{EV1: "Bob"}` */
export interface Crew {
  EV1: string;
  EV2: string;
  SUIT_IV: string;
}

export interface AllCrews {
  [key: string]: Crew;
}

/** Largest chunk of time within a Sequence */
export interface Activity {
  /** Description of the activity */
  content: string;
  /** Color to use when rendering this activity */
  color: string;
  /** seconds */
  duration: number;
  /** Seconds into the UTC day */
  startTimeSeconds?: number;
  /** Seconds into the UTC day */
  endTimeSeconds?: number;
}

/** Enum that uses IO collections `cols`= query param in the IO API as a value. Pulled from the `cid=` in URLs like https://io.jsc.nasa.gov/app/collections.cfm?cid=2359937 */
export enum Collection {
  /** International Space Station. https://io.jsc.nasa.gov/app/collections.cfm?cid=4 */
  ISS = 4,
  /** All test events */
  TEST_EVENTS = 2359932,
  /** JSC Rock Yard. https://io.jsc.nasa.gov/app/collections.cfm?cid=2359937 (why the quoted string with spaces? so it matches the Test Environment name in the exploration wiki */
  "JSC Rock Yard" = 2359937,
  /** Neutral Buoyancy Lab. https://io.jsc.nasa.gov/app/collections.cfm?cid=2359935 */
  NBL = 2359935,
  /** Artificial Reduced Gravity Offload System. https://io.jsc.nasa.gov/app/collections.cfm?cid=2359933 */
  ARGOS = 2359933,
  /** NASA Extreme Environment Mission Operations. https://io.jsc.nasa.gov/app/collections.cfm?cid=2359936 */
  NEEMO = 2359936,
}

export interface DayNightObj {
  appSeconds: number;
  daylight: boolean;
}

export interface DayNight {
  dataStartUTC?: number;
  events?: Activity[];
}

/** Metadata we can expect all photos and videos from IO to have */
export interface MediaFile {
  id: string;
  title?: string;
  description: string;
  /** Highest-level collection where this video is stored in IO */
  collection: Collection;
  /** Full list of collections from IO */
  collections: string;
  /** Link to this file's metadata on IO */
  dataURL: string;
  /** Direct link to the low res version of this file. All videos are low res */
  mediaLowResURL: string;
  /** Direct link to the high res version of this file */
  mediaHighResURL?: string;
}

/** Parsed metadata from an IO video file result */
export interface VideoFile extends MediaFile {
  /** UTC seconds at the video start */
  start: number;
  /** UTC seconds at the video end */
  end: number;
  /** Downlink number - only relevant for ISS video */
  downlink: number;
  /** Whether the video was taken during a loss of signal event */
  LOS: boolean;
  /** Only used to sort videos */
  priority: number;
  /** video start time */
  startDateTime: string;
}

/** Parsed metadata from an IO photo file result */
export interface PhotoFile extends MediaFile {
  dateAdded: string;
  datetimeTaken: string;
  datetimeTakenAppSeconds: number;
  gps?: {
    lat: number;
    lng: number;
    altitude: number;
    timestamp: string;
  };
}
