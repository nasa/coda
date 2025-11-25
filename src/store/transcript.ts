import { createSlice } from "@reduxjs/toolkit";

export const initialState: TranscriptState = {
  transcripts: [], // indexed by S/G channel number - 1
  metadata: null,
};

export const transcriptSlice = createSlice({
  name: "transcript",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    setTranscripts: (state, action: { payload: FetchResponse<UnprocessedTranscript[]> }) => {
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
      state.metadata = action.payload.fetchMetadata;
    },
    clearTranscripts: (state) => {
      state.transcripts = [];
      state.metadata = null;
    },
    transcriptFetchError: (state, action: { payload: string }) => {
      state.metadata = {
        success: false,
        error: action.payload,
        timestamp: state.metadata?.timestamp || new Date().toISOString(),
      };
    },
  },
});

export const { setTranscripts, clearTranscripts, transcriptFetchError } = transcriptSlice.actions;
