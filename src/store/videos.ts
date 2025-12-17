import { createSlice } from "@reduxjs/toolkit";

export const initialState: VideosState = {
  videoFiles: [],
  mtxPlaybackAvailability: {},
  mtxHlsEndpoints: [],
  metadataIo: null,
  metadataMtx: null,
};

export const videoSlice = createSlice({
  name: "video",
  initialState,
  reducers: {
    /** Add new video files to the store */
    addVideos: (state, action: { payload: FetchResponse<VideoFile[]> }) => {
      state.videoFiles = action.payload.data || []; // null returned when retriever error
      state.metadataIo = action.payload.fetchMetadata;
    },

    /** Clear all videos from the store */
    clearVideos: (state) => {
      state.videoFiles = [];
      state.metadataIo = null;
    },

    /** An error occured fetching video metadata */
    fetchErrorIo: (state, action: { payload: string }) => {
      const error = action.payload.replace(/key=.*&/, "key=[key]&");
      state.metadataIo = {
        success: false,
        error,
        timestamp: state.metadataIo?.timestamp || new Date().toISOString(),
      };
    },

    /** An error occured fetching MTX video metadata */
    fetchErrorMtx: (state, action: { payload: string }) => {
      const error = action.payload.replace(/key=.*&/, "key=[key]&");
      state.metadataMtx = {
        success: false,
        error,
        timestamp: state.metadataMtx?.timestamp || new Date().toISOString(),
      };
    },

    setMtxPlayback: (state, action: { payload: FetchResponse<MTXApiResponses> }) => {
      state.mtxPlaybackAvailability = action.payload.data?.mtxPlaybackAvailability || {};
      state.mtxHlsEndpoints = action.payload.data?.mtxHlsEndpoints || [];
      state.metadataMtx = action.payload.fetchMetadata;
    },
  },
});

export const { addVideos, clearVideos, fetchErrorIo, fetchErrorMtx, setMtxPlayback } =
  videoSlice.actions;
