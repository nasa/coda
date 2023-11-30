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
  time: Date;
};
