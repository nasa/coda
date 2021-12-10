interface ResMetadata {
  fromCache: boolean;
  cacheTimestamp: Date;
  stale: boolean;
  error?: string;
  mocked?: boolean;
}

enum LoadingStatusEnum {
  LOADING = "loading",
  LOADED = "loaded",
  UNNEEDED = "unneeded",
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
  lastChecked: string;
};

/**
 * Photo store
 */

type PhotosEntityState = EntityState<PhotoFile> & {
  activePhoto: PhotoFile;
  ready: boolean;
  metadata: ResMetadata;
  loadingStatus: LoadingStatusEnum;
  lastChecked: string;
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
  /** Match the video player to a downlink, @see {VideoFile.downlink}. Keyed by the ID of the video player */
  downlinks: { [key: number]: number };
  /** ID of nonDownlinkVideoSelected */
  nonDownlinkIDs: { [key: number]: string };
  /** Match the video player to a video file ID, @see {VideoFile.id}. Keyed by the ID of the video player */
  activeVideoFiles: { [key: number]: string };
  /** Whether or not the videos are ready to be played and the timeline can run. Keyed by the ID of the video player */
  ready: { [key: number]: boolean };
  metadata: ResMetadata;
  loadingStatus: LoadingStatusEnum;
  /** UTC string of the last time we hit IO */
  lastChecked: string;
};
