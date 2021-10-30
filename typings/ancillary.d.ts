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

export interface AncillaryPhoto {
  filenameRoot: string;
  directory: string;
  dateTimeOriginal: string;
  gps?: {
    lat: number;
    lng: number;
    altitude: number;
    timestamp: string;
  };
}

export interface AncillaryPayload {
  getPhotos: boolean;
  gps_tracks: GPSTrack[];
  photos?: AncillaryPhoto[];
}
