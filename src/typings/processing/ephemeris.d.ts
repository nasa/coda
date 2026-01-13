interface EphemerisStore {
  ephemera: EphemerisEntry[];
}

interface EphemerisEntry {
  epoch: string;
  tle_line1: string;
  tle_line2: string;
}

interface EphemerisRecord {
  epoch: Date;
  tle_line1: string;
  tle_line2: string;
  origin: "spacetrack" | "celestrak" | "seed";
  createdAt: Date;
}

interface SpaceTrackUpdateResult {
  success: boolean;
  epoch?: string | null; // ISO timestamp of the latest TLE epoch
  recordsInserted?: number;
  recordsSkipped?: number;
  errorMessage?: string;
}

/** Space-Track gp_history API response record */
interface SpaceTrackGpHistoryRecord {
  CCSDS_OMM_VERS: string;
  COMMENT: string;
  CREATION_DATE: string;
  ORIGINATOR: string;
  OBJECT_NAME: string;
  OBJECT_ID: string;
  CENTER_NAME: string;
  REF_FRAME: string;
  TIME_SYSTEM: string;
  MEAN_ELEMENT_THEORY: string;
  EPOCH: string;
  MEAN_MOTION: string;
  ECCENTRICITY: string;
  INCLINATION: string;
  RA_OF_ASC_NODE: string;
  ARG_OF_PERICENTER: string;
  MEAN_ANOMALY: string;
  EPHEMERIS_TYPE: string;
  CLASSIFICATION_TYPE: string;
  NORAD_CAT_ID: string;
  ELEMENT_SET_NO: string;
  REV_AT_EPOCH: string;
  BSTAR: string;
  MEAN_MOTION_DOT: string;
  MEAN_MOTION_DDOT: string;
  SEMIMAJOR_AXIS: string;
  PERIOD: string;
  APOAPSIS: string;
  PERIAPSIS: string;
  OBJECT_TYPE: string;
  RCS_SIZE: string;
  COUNTRY_CODE: string;
  LAUNCH_DATE: string;
  SITE: string;
  DECAY_DATE: string | null;
  FILE: string;
  GP_ID: string;
  TLE_LINE0: string;
  TLE_LINE1: string;
  TLE_LINE2: string;
}
