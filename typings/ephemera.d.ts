interface EphemerisStore {
  ephemera: EphemerisFile[];
}

interface EphemerisStoreWithDayNight extends EphemerisStore {
  dayNight: DayNightObjDepricated[];
}

interface EphemerisFile {
  EPOCH: string;
  TLE_LINE0: string;
  TLE_LINE1: string;
  TLE_LINE2: string;
}
