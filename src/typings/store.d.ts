declare type EMSSRole = import("@emss/oauth2-proxy-common").EMSSRole;
declare type EmssUser = import("@emss/oauth2-proxy-common").EmssUser;

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
  mtxPlaybackAvailability: MTXPlaybackAvailability;
  // string of stream names in the DL1_ISS, DL2_ISS, etc format or DL1_TE (test event), DL2_TE, etc.
  mtxHlsEndpoints: MTXHlsEndpoint[];
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

/**
 * User State
 */
type UserState = {
  user: EmssUser;
};
