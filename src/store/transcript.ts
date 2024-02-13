import { createSlice } from "@reduxjs/toolkit";
import { LoadingStatusEnum } from "utils/enums";

export const initialState: TranscriptState = {
  transcripts: [], // indexed by S/G channel number - 1
  responseMetadata: null,
  loadingStatus: LoadingStatusEnum.LOADING,
  isTranscripts: false,
};

export const transcriptSlice = createSlice({
  name: "transcript",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    setTranscripts: (state, action: { payload: WrappedResponse<UnprocessedTranscript[]> }) => {
      const unprocessedTranscripts = action.payload.data;
      /** Convert the unprocessed transcript into process transcript objects in the store */
      const transcripts: Transcript[] = [];
      let anyUtterances = false;
      for (let t = 0; t < unprocessedTranscripts.length; t++) {
        const transcript: Transcript = {
          utterances: [],
        };

        for (let i = 0; i < unprocessedTranscripts[t].unprocessedUtterances.length; i++) {
          const utterance: Utterance = {
            id: i,
            secs: unprocessedTranscripts[t].unprocessedUtterances[i][0],
            time: new Date(unprocessedTranscripts[t].unprocessedUtterances[i][0] * 1000)
              .toISOString()
              .substring(11, 19),
            speaker: unprocessedTranscripts[t].unprocessedUtterances[i][1],
            content: unprocessedTranscripts[t].unprocessedUtterances[i][2],
          };
          transcript.utterances.push(utterance);
          if (!anyUtterances) {
            anyUtterances = true;
          }
        }
        transcripts.push(transcript);
      }
      state.transcripts = transcripts;
      state.responseMetadata = { ...state.responseMetadata, ...action.payload.responseMetadata };
      state.isTranscripts = anyUtterances;
    },
    clearTranscripts: (state) => {
      state.transcripts = [];
      state.responseMetadata = null;
      state.loadingStatus = LoadingStatusEnum.LOADING;
    },
    transcriptFetchError: (state, action: { payload: string }) => {
      state.responseMetadata = { ...state.responseMetadata, error: action.payload };
    },
    setTranscriptLoadingStatus: (state, action: { payload: LoadingStatusEnum }) => {
      state.loadingStatus = action.payload;
    },
  },
});

export const {
  setTranscripts,
  clearTranscripts,
  transcriptFetchError,
  setTranscriptLoadingStatus,
} = transcriptSlice.actions;
