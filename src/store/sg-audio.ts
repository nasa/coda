import { createSlice } from "@reduxjs/toolkit";

export const initialState: SgAudioState = {
  sgActivityFullUrlRecord: {
    override: false,
    sgActivityRangeFullUrlRecords: [[], [], [], []] as SgActivityRangeFullUrlRecord[][], // indexed by S/G channel number - 1
  },
  responseMetadata: null,
  loadingStatus: "loading",
};

export const sgAudioSlice = createSlice({
  name: "sg_audio",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    setSgAudioActivity: (state, action: { payload: WrappedResponse<SgActivityFullUrlRecord> }) => {
      state.sgActivityFullUrlRecord = action.payload.data;
      state.responseMetadata = { ...state.responseMetadata, ...action.payload.responseMetadata };
      state.loadingStatus = "loaded";
    },
    clearSgAudioActivity: (state) => {
      state.sgActivityFullUrlRecord = null;
      state.responseMetadata = null;
      state.loadingStatus = "loading";
    },
    sgAudioFetchError: (state, action: { payload: string }) => {
      state.responseMetadata = { ...state.responseMetadata, error: action.payload };
    },
    setSgAudioLoadingStatus: (state, action: { payload: LoadingStatus }) => {
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
