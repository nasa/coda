import { createSlice } from "@reduxjs/toolkit";
import { LoadingStatusEnum } from "utils/enums";

export const initialState: SgAudioState = {
  sgActivityRanges: [], // indexed by S/G channel number - 1
  cacheMetadata: null,
  loadingStatus: LoadingStatusEnum.LOADING,
};

export const sgAudioSlice = createSlice({
  name: "sg_audio",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    setSgAudioActivity: (
      state,
      action: { payload: WrappedResponse<SgActivityRangeRecord[][]> }
    ) => {
      state.sgActivityRanges = action.payload.data;
      state.cacheMetadata = { ...state.cacheMetadata, ...action.payload.cacheMetadata };
    },
    clearSgAudioActivity: (state) => {
      state.sgActivityRanges = [];
      state.cacheMetadata = null;
      state.loadingStatus = LoadingStatusEnum.LOADING;
    },
    sgAudioFetchError: (state, action: { payload: string }) => {
      state.cacheMetadata = { ...state.cacheMetadata, error: action.payload };
    },
    setSgAudioLoadingStatus: (state, action: { payload: LoadingStatusEnum }) => {
      state.loadingStatus = action.payload;
    },
  },
});

export const {
  setSgAudioActivity,
  clearSgAudioActivity,
  sgAudioFetchError,
  setSgAudioLoadingStatus,
} = sgAudioSlice.actions;
