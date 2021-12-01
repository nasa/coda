import type { Point } from "gpxparser";

export interface GPSTrack {
  name: string;
  points: Point[];
  slopes: number[];
}
