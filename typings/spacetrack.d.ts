import { DayNightObj } from ".";

export interface EphemerisStore {
  ephemera: EphemerisFile[];
  dayNight: DayNightObj[];
}

export interface EphemerisFile {
  COMMENT: string;
  ORIGINATOR: string;
  NORAD_CAT_ID: string;
  OBJECT_NAME: string;
  OBJECT_TYPE: string;
  CLASSIFICATION_TYP: string;
  INTLDES: string;
  EPOCH: string;
  EPOCH_MICROSECONDS: string;
  MEAN_MOTION: string;
  ECCENTRICITY: string;
  INCLINATION: string;
  RA_OF_ASC_NODE: string;
  ARG_OF_PERICENTER: string;
  MEAN_ANOMALY: string;
  EPHEMERIS_TYPE: string;
  ELEMENT_SET_NO: string;
  REV_AT_EPOCH: string;
  BSTAR: string;
  MEAN_MOTION_DOT: string;
  MEAN_MOTION_DDOT: string;
  FILE: string;
  TLE_LINE0: string;
  TLE_LINE1: string;
  TLE_LINE2: string;
  OBJECT_ID: string;
  OBJECT_NUMBER: string;
  SEMIMAJOR_AXIS: string;
  PERIOD: string;
  APOGEE: string;
  PERIGEE: string;
  DECAYED: string;
}
