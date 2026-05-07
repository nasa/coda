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

/**
 * Space-Track `gp` class API response record (subset).
 * Only TLE_LINE1 / TLE_LINE2 are requested via `predicates` to minimize payload —
 * other fields are stripped out by Space-Track before the response is sent.
 */
interface SpaceTrackGpRecord {
  TLE_LINE1: string;
  TLE_LINE2: string;
}
