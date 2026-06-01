import { createSlice } from "@reduxjs/toolkit";

export type PcdAudioDateGate = { start: string; end: string } | null;

export type PcdAudioState = {
  audioJson: PcdAudioJson | null;
  ready: boolean;
  metadata: FetchMetadata | null;
  /** Date gate derived from the earliest/latest startTime across all recordings. */
  dateGate: PcdAudioDateGate;
};

export const initialState: PcdAudioState = {
  audioJson: null,
  ready: false,
  metadata: null,
  dateGate: null,
};

function computeDateGate(audioJson: PcdAudioJson | null): PcdAudioDateGate {
  if (!audioJson) return null;
  const dates = audioJson.recordings
    .map((r) => r.startTime?.slice(0, 10))
    .filter((d): d is string => !!d)
    .sort();
  if (dates.length === 0) return null;
  return { start: dates[0], end: dates[dates.length - 1] };
}

export const pcdAudioSlice = createSlice({
  name: "pcdAudio",
  initialState,
  reducers: {
    setPcdAudioData: (state, action: { payload: FetchResponse<PcdAudioJson | null> }) => {
      state.audioJson = action.payload.data;
      state.metadata = action.payload.fetchMetadata;
      state.ready = true;
      state.dateGate = computeDateGate(action.payload.data);
    },
    clearPcdAudioData: (state) => {
      state.audioJson = null;
      state.metadata = null;
      state.ready = false;
      state.dateGate = null;
    },
  },
});

export const { setPcdAudioData, clearPcdAudioData } = pcdAudioSlice.actions;
