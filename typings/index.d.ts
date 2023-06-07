/**
 * Response from a search on Imagery Online
 */
interface IOResponse {
  results?: {
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
interface WrappedResponse<T> {
  data?: T;
  cacheMetadata: CacheMetadata;
  source?: string;
}

/** Wikibot responses */
interface WikibotResponse<T> {
  data?: T;
  mocked?: boolean;
}

/** A large contiguous section of the timeline representing an event at a location, eg. an EVA on ISS */
interface Sequence {
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
  /**
   * UUID of event in Maestro, as recorded on wiki page, if there is one.
   * Enables hitting maestro endpoint /api/v1/event/exetimelinestatus/:uuid
   */
  maestroEventUuid?: string | false;
}

/** Crew names keyed by actor, eg. `{EV1: "Bob"}` */
interface Crew {
  EV1: string;
  EV2: string;
  SUIT_IV: string;
}

interface AllCrews {
  [key: string]: Crew;
}

/** Largest chunk of time within a Sequence */
interface Activity {
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

/** Metadata we can expect all photos and videos from IO to have */
interface MediaFile {
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
  /** Direct link to the thumbnail version of this file */
  mediaThumbURL?: string;
}

/** Parsed metadata from an IO video file result */
interface VideoFile extends MediaFile {
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
interface PhotoFile extends MediaFile {
  dateAdded: string;
  datetimeTaken: string;
  /** appSeconds is seconds since midnight on the current date */
  datetimeTakenAppSeconds: number;
  gps?: {
    lat: number;
    lng: number;
    altitude: number;
    timestamp: string;
  };
}

interface QueryParams {
  /** yyyy-mm-dd the user wants to view */
  date: string;
  /** UTC hh:mm the user wants to view */
  gmt: string;
  /** Downlink number the user wants to view in player 1 */
  video1: string;
  /** Downlink number the user wants to view in player 2 */
  video2: string;
  /** ID of the non-D/L video the user wants to view in player 1 */
  nonDLvideo1: string;
  /** ID of the non-D/L video the user wants to view in player 2 */
  nonDLvideo2: string;
}

type FetchOptionsCredentials = "include" | "same-origin" | "omit";
