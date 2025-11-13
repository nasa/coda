import { createSlice } from "@reduxjs/toolkit";

export const initialState: SgAudioState = {
  sgActivityFullUrlRecord: {
    override: false,
    sgActivityRangeFullUrlRecords: [[], [], [], []] as SgActivityRangeFullUrlRecord[][], // indexed by S/G channel number - 1
  },
  metadata: null,
};

export const sgAudioSlice = createSlice({
  name: "sg_audio",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    setSgAudioActivity: (state, action: { payload: FetchResponse<SgActivityFullUrlRecord> }) => {
      state.sgActivityFullUrlRecord = action.payload.data;
      state.metadata = action.payload.fetchMetadata;
    },
    clearSgAudioActivity: (state) => {
      state.sgActivityFullUrlRecord = null;
      state.metadata = null;
    },
    sgAudioFetchError: (state, action: { payload: string }) => {
      state.metadata = {
        success: false,
        error: action.payload,
        timestamp: state.metadata?.timestamp || new Date().toISOString(),
      };
    },
  },
});

export const { setSgAudioActivity, clearSgAudioActivity, sgAudioFetchError } = sgAudioSlice.actions;
