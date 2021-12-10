import type { Point } from "gpxparser";

interface GPSTrack {
  name: string;
  points: Point[];
  slopes: number[];
}
