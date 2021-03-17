import fetch from "isomorphic-unfetch";
import { changeTime, PlayheadState } from "store/playhead";
import { padZeros } from "utils/formatting";

export type Ephemeris = {
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
};

async function fetchSpacetrack(dateStr: string): Promise<Ephemeris[]> {
  const url = "http://coda-data.apolloinrealtime.org/spacetrack_iss/get_iss.php?date=" + dateStr;

  let res: Response;

  try {
    res = await fetch(url);
  } catch (e) {
    throw e;
  }
  return res.json();
}

export async function buildEphemerisStore(
  year: number,
  month: number,
  date: number
): Promise<Ephemeris[]> {
  const ephemerisData = await fetchSpacetrack(`${year}-${padZeros(month, 2)}-${padZeros(date, 2)}`);
  return ephemerisData;
}
