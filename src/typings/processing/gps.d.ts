interface GPSTrack {
  name: string;
  points: GPSPoint[];
}

interface GPSTrackToggles {
  [key: string]: boolean;
}

type GPSPoint = {
  lat: number;
  lon: number;
  ele: number;
  time: string;
};

// Database types
type GPXTrackRecord = {
  id: number;
  date: string;
  name: string;
  gpxData: string;
};

type GPXTrackRecord_db_type = GPXTrackRecord;

type GPXTrackListRecord = Omit<GPXTrackRecord, "gpxData">;
