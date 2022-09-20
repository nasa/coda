interface CacheMetadata {
  fromCache: boolean;
  timestamp: Date;
  stale: boolean;
  error?: string;
  mocked?: boolean;
}

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
  ephemera: EphemerisFile[];
  cacheMetadata: ResMetadata;
  loadingStatus: LoadingStatusEnum;
};

/**
 * DayNight Store
 */
type DayNightState = {
  dayNight: DayNightObj[];
  cacheMetadata: ResMetadata;
  loadingStatus: LoadingStatusEnum.LOADING;
};

/**
 * Sequence store
 */

type SequencesEntityState = EntityState<Sequence> & {
  cacheMetadata: ResMetadata;
  loadingStatus: LoadingStatusEnum;
};

/**
 * Photo store
 */

type PhotosEntityState = EntityState<PhotoFile> & {
  activePhoto: PhotoFile;
  ready: boolean;
  cacheMetadata: ResMetadata;
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
type VideosEntityState = EntityState<VideoFile> & {
  cacheMetadata: ResMetadata;
  loadingStatus: LoadingStatusEnum;
};

/**
 * GPS Store
 */
type GPSState = {
  gpsTracks: GPSTrack[];
  cacheMetadata: CacheMetadata;
  loadingStatus: LoadingStatusEnum;
};

/**
 * Transcript Store
 */
type TranscriptState = {
  transcripts: Transcript[];
  cacheMetadata: CacheMetadata;
  loadingStatus: LoadingStatusEnum;
  isTranscripts: boolean;
};

/**
 * SG Audio Store
 */
type SgAudioState = {
  sgActivityRanges: SgActivityRangeRecord[][];
  cacheMetadata: CacheMetadata;
  loadingStatus: LoadingStatusEnum;
};

/**
 * Graph Store
 */
type GraphsState = {
  graphsManifest: GraphsManifest;
  cacheMetadata: CacheMetadata;
  loadingStatus: LoadingStatusEnum;
};
