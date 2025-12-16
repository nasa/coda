interface EphemerisStore {
  ephemera: EphemerisEntry[];
}

interface EphemerisEntry {
  epoch: string;
  tle_line1: string;
  tle_line2: string;
}

interface Ephemeris_db_type {
  epoch: Date;
  tle_line1: string;
  tle_line2: string;
  origin: "celestrak" | "seed";
  createdAt: Date;
}

interface CelestrakUpdateResult {
  success: boolean;
  epoch?: string; // ISO timestamp of the TLE epoch
  errorMessage?: string;
}
