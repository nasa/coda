import { createSlice } from "@reduxjs/toolkit";
import { TimingData, VideoActivity, VideoItem } from "services/io";

export interface VideosState {
  initialized: Boolean;
  gTimingData: TimingData;
  gVideoActivityByGroupBySecond: VideoActivity;
  gVideoItems: VideoItem[];
  gSelectedVidGroup: number;
}

export const initialState: VideosState = {
  initialized: false,
  gVideoActivityByGroupBySecond: null,
  gSelectedVidGroup: null,
  gVideoItems: null,
  gTimingData: null,
};

export const videoSlice = createSlice({
  name: "video",
  initialState,
  reducers: {
    initialize: (state, action) => {
      state.initialized = true;
      state.gVideoActivityByGroupBySecond =
        action.payload.gVideoActivityByGroupBySecond;
      state.gTimingData = action.payload.gTimingData;
      state.gVideoItems = action.payload.gVideoItems;
    },
  },
});

export const { initialize } = videoSlice.actions;
