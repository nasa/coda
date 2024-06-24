import { createSlice } from "@reduxjs/toolkit";

export const initialState: GPSState = {
  gpsTracks: [],
  responseMetadata: null,
  loadingStatus: "loading",
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
      state.loadingStatus = "loading";
    },
    gpsFetchError: (state, action: { payload: string }) => {
      state.responseMetadata = { ...state.responseMetadata, error: action.payload };
    },
    setGpsLoadingStatus: (state, action: { payload: LoadingStatus }) => {
      state.loadingStatus = action.payload;
    },
  },
});

export const { setGPSTracks, clearGPSTracks, gpsFetchError, setGpsLoadingStatus } =
  gpsSlice.actions;
