import { createSlice } from "@reduxjs/toolkit";
import { WrappedResponse } from "typings";
import type { GPSTrack } from "typings/gps";

export interface GPSState {
  gpsTracks: GPSTrack[];
  cacheStatus: {
    cacheRead?: boolean;
    cacheWrite?: boolean;
  };
  errorMessage: string;
}

export const initialState: GPSState = {
  gpsTracks: [],
  cacheStatus: {},
  errorMessage: "",
};

export const gpsSlice = createSlice({
  name: "gps",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    setGPSTracks: (state, action: { payload: WrappedResponse<GPSTrack[]> }) => {
      state.gpsTracks = action.payload.data;
      state.cacheStatus = {
        cacheRead: action.payload.cacheRead,
        cacheWrite: action.payload.cacheWrite,
      };
    },
    gpsFetchError: (state, action: { payload: string }) => {
      state.errorMessage = action.payload;
    },
  },
});

export const { setGPSTracks, gpsFetchError } = gpsSlice.actions;
