import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { createWrapper } from "next-redux-wrapper";

import { playheadSlice, initialState as playheadInitialState } from "./playhead";
import { playheadHoverSlice, initialState as playheadHoverInitialState } from "./playheadHover";
import { sequencesSlice, initialState as sequencesInitialState } from "./sequences";
import { videoSlice, initialState as videosInitialState } from "./videos";
import { frameworkSlice, initialState as viewerInitialState } from "./framework";
import { photoSlice, initialState as photosInitialState } from "./photos";
import { ephemeraSlice, initialState as ephemeraInitialState } from "./ephemera";
import { gpsSlice, initialState as gpsInitialState } from "./gps";
import { transcriptSlice, initialState as transcriptInitialState } from "./transcript";
import { sgAudioSlice, initialState as sgAudioInitialState } from "./sg-audio";

let store;

export const initialState = {
  playhead: playheadInitialState,
  playheadHover: playheadHoverInitialState,
  sequences: sequencesInitialState,
  videos: videosInitialState,
  photos: photosInitialState,
  ephemera: ephemeraInitialState,
  gps: gpsInitialState,
  transcript: transcriptInitialState,
  framework: viewerInitialState,
  sgAudio: sgAudioInitialState,
};

// server-side redux technique adapted from https://github.com/vercel/next.js/blob/canary/examples/with-redux/store.js#L50

const reducer = combineReducers({
  playhead: playheadSlice.reducer,
  playheadHover: playheadHoverSlice.reducer,
  sequences: sequencesSlice.reducer,
  videos: videoSlice.reducer,
  photos: photoSlice.reducer,
  ephemera: ephemeraSlice.reducer,
  gps: gpsSlice.reducer,
  transcript: transcriptSlice.reducer,
  framework: frameworkSlice.reducer,
  sgAudio: sgAudioSlice.reducer,
});

const initStore = () => {
  store = configureStore({
    reducer,
    preloadedState: initialState,
    devTools: true,
  });
  return store;
};

export const wrapper = createWrapper(initStore);

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;
