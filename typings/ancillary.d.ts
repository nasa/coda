import type { Point } from "gpxparser";
import { PhotoFile, VideoFile } from ".";

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
  durationSeconds: number;
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

export interface AncillaryPayload {
  gpsTracks: GPSTrack[];
  photos: PhotoFile[];
  videos: VideoFile[];
}
