interface EphemerisStore {
  ephemera: EphemerisFile[];
}

interface EphemerisFile {
  EPOCH: string;
  TLE_LINE0: string;
  TLE_LINE1: string;
  TLE_LINE2: string;
}
