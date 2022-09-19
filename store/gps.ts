import { createSlice } from "@reduxjs/toolkit";
import { LoadingStatusEnum } from "utils/enums";

export const initialState: GPSState = {
  gpsTracks: [],
  cacheMetadata: null,
  loadingStatus: LoadingStatusEnum.LOADING,
};

export const gpsSlice = createSlice({
  name: "gps",
  initialState,
  reducers: {
    /** Add new gps tracks to the store */
    setGPSTracks: (state, action: { payload: WrappedResponse<GPSTrack[]> }) => {
      state.gpsTracks = action.payload.data;
      state.cacheMetadata = { ...state.cacheMetadata, ...action.payload.cacheMetadata };
    },
    clearGPSTracks: (state) => {
      state.gpsTracks = [];
      state.cacheMetadata = null;
      state.loadingStatus = LoadingStatusEnum.LOADING;
    },
    gpsFetchError: (state, action: { payload: string }) => {
      state.cacheMetadata = { ...state.cacheMetadata, error: action.payload };
    },
    setGpsLoadingStatus: (state, action: { payload: LoadingStatusEnum }) => {
      state.loadingStatus = action.payload;
    },
  },
});

export const { setGPSTracks, clearGPSTracks, gpsFetchError, setGpsLoadingStatus } =
  gpsSlice.actions;
