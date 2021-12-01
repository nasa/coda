import { createSlice } from "@reduxjs/toolkit";
import type { GPSTrack } from "typings/gps";

export interface GPSState {
  gpsTracks: GPSTrack[];
  errorMessage: string;
}

export const initialState: GPSState = {
  gpsTracks: [],
  errorMessage: "",
};

export const gpsSlice = createSlice({
  name: "gps",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    setGPSTracks: (state, action: { payload: GPSTrack[] }) => {
      state.gpsTracks = action.payload;
    },
    gpsFetchError: (state, action: { payload: string }) => {
      state.errorMessage = action.payload;
    },
  },
});

export const { setGPSTracks, gpsFetchError } = gpsSlice.actions;
