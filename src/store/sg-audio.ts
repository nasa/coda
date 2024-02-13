import { createSlice } from "@reduxjs/toolkit";
import { LoadingStatusEnum } from "utils/enums";

export const initialState: SgAudioState = {
  sgActivityRecord: {
    overrideBaseUrl: null,
    sgActivityRangeRecords: [[], [], [], []] as SgActivityRangeRecord[][], // indexed by S/G channel number - 1
  },
  responseMetadata: null,
  loadingStatus: LoadingStatusEnum.LOADING,
};

export const sgAudioSlice = createSlice({
  name: "sg_audio",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    setSgAudioActivity: (state, action: { payload: WrappedResponse<SgActivityRecord> }) => {
      state.sgActivityRecord = action.payload.data;
      state.responseMetadata = { ...state.responseMetadata, ...action.payload.responseMetadata };
      state.loadingStatus = LoadingStatusEnum.LOADED;
    },
    clearSgAudioActivity: (state) => {
      state.sgActivityRecord = null;
      state.responseMetadata = null;
      state.loadingStatus = LoadingStatusEnum.LOADING;
    },
    sgAudioFetchError: (state, action: { payload: string }) => {
      state.responseMetadata = { ...state.responseMetadata, error: action.payload };
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
