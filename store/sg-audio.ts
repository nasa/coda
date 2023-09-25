import { createSlice } from "@reduxjs/toolkit";
import { LoadingStatusEnum } from "utils/enums";

export const initialState: SgAudioState = {
  sgActivityRecord: {
    overrideBaseUrl: null,
    sgActivityRangeRecords: [[], [], [], []] as SgActivityRangeRecord[][], // indexed by S/G channel number - 1
  },
  cacheMetadata: null,
  loadingStatus: LoadingStatusEnum.LOADING,
};

export const sgAudioSlice = createSlice({
  name: "sg_audio",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    setSgAudioActivity: (state, action: { payload: WrappedResponse<SgActivityRecord> }) => {
      state.sgActivityRecord = action.payload.data;
      state.cacheMetadata = { ...state.cacheMetadata, ...action.payload.cacheMetadata };
      state.loadingStatus = LoadingStatusEnum.LOADED;
    },
    clearSgAudioActivity: (state) => {
      state.sgActivityRecord = null;
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
