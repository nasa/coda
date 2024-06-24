/**
 * Playhead stores
 */
interface PlayheadState {
  /** Seconds representing the time into the mission day, eg. `0` is 00:00:00Z, `86399` is 23:59:59Z */
  seconds: number;
  /** UTC date being viewed */
  date: string;
  /** Whether the playhead actually is running */
  isRunning: boolean;
  /** Whether the user wants the playhead to be running */
  ready: boolean;
}

interface PlayheadHoverState {
  /** Seconds representing the time into the mission day that the mouse is hovering on via the nav-timeline */
  seconds: number;
}

/**
 * Ephemera store
 */

type EphemeraState = {
  ephemerisFiles: EphemerisFile[];
  responseMetadata: ResponseMetadata;
  loadingStatus: LoadingStatus;
};

/**
 * DayNight Store
 */
type DayNightState = {
  dayNight: DayNightObj[];
  responseMetadata: ResponseMetadata;
  loadingStatus: LoadingStatus;
  source?: string;
};

/**
 * Sequence store
 */

type SequencesState = {
  allSequences: Sequence[];
  responseMetadata: ResponseMetadata;
  loadingStatus: LoadingStatus;
};

/**
 * Photo store
 */

type PhotosState = {
  photoFiles: PhotoFile[];
  activePhoto: PhotoFile;
  ready: boolean;
  responseMetadata: ResponseMetadata;
  loadingStatus: LoadingStatus;
  collectionFilters: PhotoCollectionFilters[];
};

interface PhotoCollectionFilters {
  fullList: string;
  display: string;
  selected: boolean;
}

/**
 * Video store
 */

/** Info about videos from IO and the desired high-level state of the video players */
type VideosState = {
  videoFiles: VideoFile[];
  responseMetadata: ResponseMetadata;
  loadingStatus: LoadingStatus;
};

/**
 * GPS Store
 */
type GPSState = {
  gpsTracks: GPSTrack[];
  responseMetadata: ResponseMetadata;
  loadingStatus: LoadingStatus;
};

/**
 * Transcript Store
 */
type TranscriptState = {
  transcripts: Transcript[];
  responseMetadata: ResponseMetadata;
  loadingStatus: LoadingStatus;
  isTranscripts: boolean;
};

/**
 * SG Audio Store
 */
type SgAudioState = {
  sgActivityFullUrlRecord: SgActivityFullUrlRecord;
  responseMetadata: ResponseMetadata;
  loadingStatus: LoadingStatus;
};

/**
 * Graph Store
 */
type GraphsState = {
  graphsManifest: GraphsManifest;
  responseMetadata: ResponseMetadata;
  loadingStatus: LoadingStatus;
};

/**
 * Maestro Store
 */
type MaestroState = {
  title: string;
  crewAssignment: Crew;
  processedActivitiesData: { [key: string]: Activity[] };
  evaStartSec: number;
  evaEndSec: number;
  evaDurationSec: number;
  responseMetadata: ResponseMetadata;
  loadingStatus: LoadingStatus;
};
