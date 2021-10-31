import { createSlice } from "@reduxjs/toolkit";
import type { GPSTrack } from "typings/ancillary";

export interface AncillaryDataItems {
  photosRetrieved: boolean;
  videosRetrieved: boolean;
  gpsTracks: GPSTrack[];
}
export interface AncillaryState {
  dataItems: AncillaryDataItems;
  errorMessage: string;
}

export const initialState: AncillaryState = {
  dataItems: {
    photosRetrieved: false,
    videosRetrieved: false,
    gpsTracks: [],
  },
  errorMessage: "",
};

export const ancillarySlice = createSlice({
  name: "ancillary",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    setAncillaryData: (state, action: { payload: AncillaryDataItems }) => {
      state.dataItems = action.payload;
    },
    ancillaryFetchError: (state, action: { payload: string }) => {
      state.errorMessage = action.payload;
    },
  },
});

export const { setAncillaryData, ancillaryFetchError } = ancillarySlice.actions;
