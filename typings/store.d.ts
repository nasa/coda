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
  loadingStatus: LoadingStatusEnum;
};

/**
 * DayNight Store
 */
type DayNightState = {
  dayNight: DayNightObj[];
  responseMetadata: ResponseMetadata;
  loadingStatus: LoadingStatusEnum.LOADING;
  source?: string;
};

/**
 * Sequence store
 */

type SequencesState = {
  allSequences: Sequence[];
  responseMetadata: ResponseMetadata;
  loadingStatus: LoadingStatusEnum;
};

/**
 * Photo store
 */

type PhotosState = {
  photoFiles: PhotoFile[];
  activePhoto: PhotoFile;
  ready: boolean;
  responseMetadata: ResponseMetadata;
  loadingStatus: LoadingStatusEnum;
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
  loadingStatus: LoadingStatusEnum;
};

/**
 * GPS Store
 */
type GPSState = {
  gpsTracks: GPSTrack[];
  responseMetadata: ResponseMetadata;
  loadingStatus: LoadingStatusEnum;
};

/**
 * Transcript Store
 */
type TranscriptState = {
  transcripts: Transcript[];
  responseMetadata: ResponseMetadata;
  loadingStatus: LoadingStatusEnum;
  isTranscripts: boolean;
};

/**
 * SG Audio Store
 */
type SgAudioState = {
  sgActivityRecord: SgActivityRecord;
  responseMetadata: ResponseMetadata;
  loadingStatus: LoadingStatusEnum;
};

/**
 * Graph Store
 */
type GraphsState = {
  graphsManifest: GraphsManifest;
  responseMetadata: ResponseMetadata;
  loadingStatus: LoadingStatusEnum;
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
  loadingStatus: LoadingStatusEnum;
};
