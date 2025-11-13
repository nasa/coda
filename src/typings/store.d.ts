declare type EMSSRole = import("@emss/oauth2-proxy-common").EMSSRole;
declare type EmssUser = import("@emss/oauth2-proxy-common").EmssUser;

/**
 * Ephemera store
 */

type EphemeraState = {
  ephemerisFiles: EphemerisFile[];
  metadata: FetchMetadata | null;
};

/**
 * DayNight Store
 */
type DayNightState = {
  dayNight: DayNightObj[];
  metadata: FetchMetadata | null;
  source?: string;
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
 * Transcript Store
 */
type TranscriptState = {
  transcripts: Transcript[];
  metadata: FetchMetadata | null;
  isTranscripts: boolean;
};

/**
 * SG Audio Store
 */
type SgAudioState = {
  sgActivityFullUrlRecord: SgActivityFullUrlRecord;
  metadata: FetchMetadata | null;
};

/**
 * Graph Store
 */
type GraphsState = {
  graphsManifest: GraphsManifest;
  metadata: FetchMetadata | null;
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
  metadata: FetchMetadata | null;
};

/**
 * User State
 */
type UserState = {
  user: EmssUser;
};
