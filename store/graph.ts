import { createSlice } from "@reduxjs/toolkit";
import { LoadingStatusEnum } from "utils/enums";

export const initialState: GraphState = {
  graphManifest: null,
  cacheMetadata: null,
  loadingStatus: LoadingStatusEnum.LOADING,
};

export const graphSlice = createSlice({
  name: "graph",
  initialState,
  reducers: {
    /** Add new graph manifest to the store */
    setGraphManifest: (state, action: { payload: WrappedResponse<GraphManifest> }) => {
      state.graphManifest = action.payload.data;
      state.cacheMetadata = { ...state.cacheMetadata, ...action.payload.cacheMetadata };
    },
    clearGraphManifest: (state) => {
      state.graphManifest = null;
      state.cacheMetadata = null;
      state.loadingStatus = LoadingStatusEnum.LOADING;
    },
    graphFetchError: (state, action: { payload: string }) => {
      state.cacheMetadata = { ...state.cacheMetadata, error: action.payload };
    },
    setGraphLoadingStatus: (state, action: { payload: LoadingStatusEnum }) => {
      state.loadingStatus = action.payload;
    },
  },
});

export const { setGraphManifest, clearGraphManifest, graphFetchError, setGraphLoadingStatus } =
  graphSlice.actions;
