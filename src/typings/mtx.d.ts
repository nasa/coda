type MTXApiResponses = {
  mtxPlaybackAvailability: MTXPlaybackAvailability;
  mtxHlsEndpointNames: MTXHlsEndpointName[];
};

type MTXPlaybackAvailability = {
  [dlNumber: string]: MtxRecordingTimeRange[];
};

type MTXHlsEndpointName =
  | "DL1_ISS"
  | "DL2_ISS"
  | "DL3_ISS"
  | "DL4_ISS"
  | "DL5_ISS"
  | "DL6_ISS"
  | "DL7_ISS"
  | "DL8_ISS"
  | "DL1_TE"
  | "DL2_TE"
  | "DL3_TE"
  | "DL4_TE"
  | "DL5_TE"
  | "DL6_TE"
  | "DL7_TE"
  | "DL8_TE";

type VideoPlayerType = "IO" | "MTX" | "HLS";

type MtxPathRecording = {
  name: string;
  segments: MtxSegment[];
};

type MtxRecordingsListResponse = {
  itemCount: number;
  pageCount: number;
  items: MtxRecordingsListItem[];
};

type MtxSegment = {
  start: string;
};

type MtxRecordingTimeRange = {
  start: string;
  duration: number;
};
