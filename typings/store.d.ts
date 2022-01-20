interface ResMetadata {
  fromCache: boolean;
  cacheTimestamp: Date;
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

type EphemeraEntityState = EntityState<EphemerisFile> & {
  dayNight: DayNightObj[];
  metadata: ResMetadata;
  loadingStatus: LoadingStatusEnum;
};

/**
 * Sequence store
 */

type SequencesEntityState = EntityState<Sequence> & {
  metadata: ResMetadata;
  loadingStatus: LoadingStatusEnum;
};

/**
 * Photo store
 */

type PhotosEntityState = EntityState<PhotoFile> & {
  activePhoto: PhotoFile;
  ready: boolean;
  metadata: ResMetadata;
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
  metadata: ResMetadata;
  loadingStatus: LoadingStatusEnum;
};
