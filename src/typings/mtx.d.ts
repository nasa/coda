type MTXApiResponses = {
  mtxPlaybackAvailability: MTXPlaybackAvailability;
  mtxHlsEndpoints: MTXHlsEndpoint[];
};

type MTXHlsEndpoint = {
  name: MTXHlsEndpointName;
  secondsAvailable: number;
};

type MTXRecordingTimeRange = {
  start: string;
  duration: number;
};

type MTXPlaybackAvailability = {
  [dlNumber: string]: MTXRecordingTimeRange[];
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
