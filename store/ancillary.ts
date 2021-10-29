import { createSlice } from "@reduxjs/toolkit";
import type { AncillaryPayload } from "typings/ancillary";

export interface AncillaryState {
  ancillaryPayload: AncillaryPayload;
  errorMessage: string;
}

export const initialState: AncillaryState = {
  ancillaryPayload: {
    getPhotos: false,
    gps_tracks: [],
  },
  errorMessage: "",
};

export const ancillarySlice = createSlice({
  name: "ancillary",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    setAncillaryData: (state, action: { payload: AncillaryPayload }) => {
      state.ancillaryPayload = action.payload;
    },
    ancillaryFetchError: (state, action: { payload: string }) => {
      state.errorMessage = action.payload;
    },
  },
});

export const { setAncillaryData, ancillaryFetchError } = ancillarySlice.actions;
