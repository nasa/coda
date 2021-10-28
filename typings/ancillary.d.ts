import type { Point } from "gpxparser";

interface GPSTrack {
  identifier: string;
  filename: string;
  track: {
    name: string;
    points: Point[];
    slopes: number[];
  };
}

export interface GPSTrackCollection {
  gps_tracks: GPSTrack[];
}
