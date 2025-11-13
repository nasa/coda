import { createSlice } from "@reduxjs/toolkit";

export const initialState: GPSState = {
  gpsTracks: [],
  metadata: null,
};

export const gpsSlice = createSlice({
  name: "gps",
  initialState,
  reducers: {
    /** Add new gps tracks to the store */
    setGPSTracks: (state, action: { payload: FetchResponse<GPSTrack[]> }) => {
      state.gpsTracks = action.payload.data || [];
      state.metadata = action.payload.fetchMetadata;
    },
    clearGPSTracks: (state) => {
      state.gpsTracks = [];
      state.metadata = null;
    },
    gpsFetchError: (state, action: { payload: string }) => {
      state.metadata = {
        success: false,
        error: action.payload,
        timestamp: state.metadata?.timestamp || new Date().toISOString(),
      };
    },
  },
});

export const { setGPSTracks, clearGPSTracks, gpsFetchError } = gpsSlice.actions;
