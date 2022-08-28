import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { createWrapper } from "next-redux-wrapper";

import { playheadSlice, initialState as playheadInitialState } from "./playhead";
import { playheadHoverSlice, initialState as playheadHoverInitialState } from "./playheadHover";
import { sequencesSlice, initialState as sequencesInitialState } from "./sequences";
import { videoSlice, initialState as videosInitialState } from "./videos";
import { frameworkSlice, initialState as viewerInitialState } from "./framework";
import { photoSlice, initialState as photosInitialState } from "./photos";
import { ephemeraSlice, initialState as ephemeraInitialState } from "./ephemera";
import { dayNightSlice, initialState as dayNightInitialState } from "./daynight";
import { gpsSlice, initialState as gpsInitialState } from "./gps";
import { transcriptSlice, initialState as transcriptInitialState } from "./transcript";
import { sgAudioSlice, initialState as sgAudioInitialState } from "./sg-audio";
import { graphSlice, initialState as graphInitialState } from "./graph";

let store;

export const initialState = {
  playhead: playheadInitialState,
  playheadHover: playheadHoverInitialState,
  sequences: sequencesInitialState,
  videos: videosInitialState,
  photos: photosInitialState,
  ephemera: ephemeraInitialState,
  dayNight: dayNightInitialState,
  gps: gpsInitialState,
  transcript: transcriptInitialState,
  framework: viewerInitialState,
  sgAudio: sgAudioInitialState,
  graph: graphInitialState,
};

const reducer = combineReducers({
  playhead: playheadSlice.reducer,
  playheadHover: playheadHoverSlice.reducer,
  sequences: sequencesSlice.reducer,
  videos: videoSlice.reducer,
  photos: photoSlice.reducer,
  ephemera: ephemeraSlice.reducer,
  dayNight: dayNightSlice.reducer,
  gps: gpsSlice.reducer,
  transcript: transcriptSlice.reducer,
  framework: frameworkSlice.reducer,
  sgAudio: sgAudioSlice.reducer,
  graph: graphSlice.reducer,
});
export type RootState = ReturnType<typeof reducer>;

const initStore = () => {
  store = configureStore({
    reducer,
    preloadedState: initialState,
    devTools: true,
  });
  return store;
};

export const wrapper = createWrapper(initStore);
