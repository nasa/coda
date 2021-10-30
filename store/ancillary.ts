import { createSlice } from "@reduxjs/toolkit";
import { PhotoFile } from "typings/index";
import type { AncillaryPayload, GPSTrack } from "typings/ancillary";

export interface AncillaryState {
  ancillaryData: {
    gps_tracks: GPSTrack[];
    photos: PhotoFile[];
  };
  errorMessage: string;
}

export const initialState: AncillaryState = {
  ancillaryData: {
    gps_tracks: [],
    photos: [],
  },
  errorMessage: "",
};

export const ancillarySlice = createSlice({
  name: "ancillary",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    setAncillaryData: (state, action: { payload: AncillaryState }) => {
      state.ancillaryData = action.payload.ancillaryData;
    },
    ancillaryFetchError: (state, action: { payload: string }) => {
      state.errorMessage = action.payload;
    },
  },
});

export const { setAncillaryData, ancillaryFetchError } = ancillarySlice.actions;
