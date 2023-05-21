interface GPSTrack {
  name: string;
  points: Point[];
  slopes: number[];
}

interface GPSTrackToggles {
  [key: string]: boolean;
}
