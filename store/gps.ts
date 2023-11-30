import { createSlice } from "@reduxjs/toolkit";
import { LoadingStatusEnum } from "utils/enums";

export const initialState: GPSState = {
  gpsTracks: [],
  responseMetadata: null,
  loadingStatus: LoadingStatusEnum.LOADING,
};

export const gpsSlice = createSlice({
  name: "gps",
  initialState,
  reducers: {
    /** Add new gps tracks to the store */
    setGPSTracks: (state, action: { payload: WrappedResponse<GPSTrack[]> }) => {
      state.gpsTracks = action.payload.data;
      state.responseMetadata = { ...state.responseMetadata, ...action.payload.responseMetadata };
    },
    clearGPSTracks: (state) => {
      state.gpsTracks = [];
      state.responseMetadata = null;
      state.loadingStatus = LoadingStatusEnum.LOADING;
    },
    gpsFetchError: (state, action: { payload: string }) => {
      state.responseMetadata = { ...state.responseMetadata, error: action.payload };
    },
    setGpsLoadingStatus: (state, action: { payload: LoadingStatusEnum }) => {
      state.loadingStatus = action.payload;
    },
  },
});

export const { setGPSTracks, clearGPSTracks, gpsFetchError, setGpsLoadingStatus } =
  gpsSlice.actions;
