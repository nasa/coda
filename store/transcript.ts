import { createSlice } from "@reduxjs/toolkit";
import { LoadingStatusEnum } from "utils/enums";

export const initialState: TranscriptState = {
  utterances: [],
  cacheMetadata: null,
  loadingStatus: LoadingStatusEnum.LOADING,
};

export const transcriptSlice = createSlice({
  name: "transcript",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    setTranscript: (state, action: { payload: WrappedResponse<UnprocessedUtterance[]> }) => {
      const responseArray = action.payload.data;
      /** Convert the unprocessed string from the wiki into an array of Utterance objects in the store */
      const transcript: Utterance[] = [];
      for (let i = 0; i < responseArray.length; i++) {
        const utterance: Utterance = {
          secs: responseArray[i][0],
          time: new Date(responseArray[i][0] * 1000).toISOString().substring(11, 19),
          speaker: responseArray[i][1],
          content: responseArray[i][2],
        };
        transcript.push(utterance);
      }
      state.utterances = transcript;
      state.cacheMetadata = { ...state.cacheMetadata, ...action.payload.cacheMetadata };
    },
    clearTranscript: (state) => {
      state.utterances = [];
      state.cacheMetadata = null;
      state.loadingStatus = LoadingStatusEnum.LOADING;
    },
    transcriptFetchError: (state, action: { payload: string }) => {
      state.cacheMetadata = { ...state.cacheMetadata, error: action.payload };
    },
    setTranscriptLoadingStatus: (state, action: { payload: LoadingStatusEnum }) => {
      state.loadingStatus = action.payload;
    },
  },
});

export const { setTranscript, clearTranscript, transcriptFetchError, setTranscriptLoadingStatus } =
  transcriptSlice.actions;
