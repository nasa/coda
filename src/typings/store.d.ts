declare type EMSSRole = import("@emss/oauth2-proxy-common").EMSSRole;
declare type EmssUser = import("@emss/oauth2-proxy-common").EmssUser;

/**
 * Ephemera store
 */

type EphemeraState = {
  ephemerisFiles: EphemerisEntry[];
  metadata: FetchMetadata | null;
};

/**
 * DayNight Store
 */
type DayNightState = {
  dayNight: DayNightObj[];
  metadata: FetchMetadata | null;
  origin?: string;
};

/**
 * Sequence store
 */

type SequencesState = {
  allSequences: Sequence[];
  metadata: FetchMetadata | null;
};

/**
 * Photo store
 */

type PhotosState = {
  photoFiles: PhotoFile[];
  activePhoto: PhotoFile;
  ready: boolean;
  metadata: FetchMetadata | null;
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
  mtxPlaybackAvailability: MTXPlaybackAvailability;
  // string of stream names in the DL1_ISS, DL2_ISS, etc format or DL1_TE (test event), DL2_TE, etc.
  mtxHlsEndpoints: MTXHlsEndpoint[];
  metadataIo: FetchMetadata | null;
  metadataMtx: FetchMetadata | null;
};

/**
 * GPS Store
 */
type GPSState = {
  gpsTracks: GPSTrack[];
  metadata: FetchMetadata | null;
};

/**
 * Talkybot Store
 */
interface TalkybotState {
  audioFiles: TbAudioFile[];
  metadata: FetchMetadata | null;
}

/**
 * Graph Store
 */
type GraphsState = {
  graphsManifest: GraphsManifest;
  metadata: FetchMetadata | null;
};

/**
 * User State
 */
type UserState = {
  user: EmssUser;
};

/**
 * Clock State
 * Manages playhead time and hover state for the application
 */
type ClockState = {
  /** UTC date being viewed (YYYY-MM-DD format or full ISO string) */
  date: string | null;
  /** Timestamp of the last start/stop user event */
  startStopTimestamp: string | null;
  /** The appSeconds value when the clock was last started or stopped */
  appSecondsAtStartStop: number;
  /** Whether the clock is currently running */
  isRunning: boolean;
  /** Hover playhead seconds (for timeline hover indicators) */
  hoverSeconds: number | null;
};
