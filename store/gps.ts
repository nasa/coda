import { createSlice } from "@reduxjs/toolkit";
import { LoadingStatusEnum, ResMetadata, WrappedResponse } from "typings";
import type { GPSTrack } from "typings/gps";

export interface GPSState {
  gpsTracks: GPSTrack[];
  metadata: ResMetadata;
  loadingStatus: LoadingStatusEnum;
}

export const initialState: GPSState = {
  gpsTracks: [],
  metadata: null,
  loadingStatus: LoadingStatusEnum.Loading,
};

export const gpsSlice = createSlice({
  name: "gps",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    setGPSTracks: (state, action: { payload: WrappedResponse<GPSTrack[]> }) => {
      state.gpsTracks = action.payload.data;
      state.metadata = { ...state.metadata, ...action.payload.metadata };
    },
    gpsFetchError: (state, action: { payload: string }) => {
      state.metadata.error = action.payload;
    },
    setGpsLoadingStatus: (state, action: { payload: LoadingStatusEnum }) => {
      state.loadingStatus = action.payload;
    },
  },
});

export const { setGPSTracks, gpsFetchError, setGpsLoadingStatus } = gpsSlice.actions;
