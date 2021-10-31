import { createSlice } from "@reduxjs/toolkit";
import { PhotoFile, VideoFile } from "typings/index";
import type { GPSTrack } from "typings/ancillary";

export interface AncillaryState {
  ancillaryData: {
    gpsTracks: GPSTrack[];
    photos: PhotoFile[];
    videos: VideoFile[];
  };
  errorMessage: string;
}

export const initialState: AncillaryState = {
  ancillaryData: {
    gpsTracks: [],
    photos: [],
    videos: [],
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
