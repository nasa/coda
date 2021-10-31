import type { Point } from "gpxparser";

export interface GPSTrack {
  name: string;
  points: Point[];
  slopes: number[];
}

export interface GPSTrackIdentifier {
  identifier: string;
  filename: string;
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

export interface AncillaryVideo {
  filename: string;
  downlink: number;
  duration_seconds: number;
  dateTime: string;
}

export interface AncillaryMetadata {
  getPhotos: boolean;
  getVideos: boolean;
  gpsIdentifiers: GPSTrackIdentifier[];
}

export interface AncillaryDataRaw {
  gpsTracks: GPSTrack[];
  photos: AncillaryPhoto[];
  videos: AncillaryVideo[];
}
