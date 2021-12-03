import { createSlice } from "@reduxjs/toolkit";
import { ResMetadata, WrappedResponse } from "typings";
import type { GPSTrack } from "typings/gps";

export interface GPSState {
  gpsTracks: GPSTrack[];
  metadata: ResMetadata;
  errorMessage: string;
}

export const initialState: GPSState = {
  gpsTracks: [],
  metadata: null,
  errorMessage: "",
};

export const gpsSlice = createSlice({
  name: "gps",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    setGPSTracks: (state, action: { payload: WrappedResponse<GPSTrack[]> }) => {
      state.gpsTracks = action.payload.data;
      state.metadata = action.payload.metadata;
    },
    gpsFetchError: (state, action: { payload: string }) => {
      state.errorMessage = action.payload;
    },
  },
});

export const { setGPSTracks, gpsFetchError } = gpsSlice.actions;
