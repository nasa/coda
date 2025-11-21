import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { sequencesSlice, initialState as sequencesInitialState } from "./sequences";
import { videoSlice, initialState as videosInitialState } from "./videos";
import { frameworkSlice, initialState as viewerInitialState } from "./framework";
import { photoSlice, initialState as photosInitialState } from "./photos";
import { ephemeraSlice, initialState as ephemeraInitialState } from "./ephemera";
import { dayNightSlice, initialState as dayNightInitialState } from "./daynight";
import { gpsSlice, initialState as gpsInitialState } from "./gps";
import { transcriptSlice, initialState as transcriptInitialState } from "./transcript";
import { sgAudioSlice, initialState as sgAudioInitialState } from "./sg-audio";
import { graphSlice, initialState as graphInitialState } from "./graphs";
import { userSlice, initialState as userInitialState } from "./user";

export const initialState = {
  sequences: sequencesInitialState,
  videos: videosInitialState,
  photos: photosInitialState,
  ephemera: ephemeraInitialState,
  dayNight: dayNightInitialState,
  gps: gpsInitialState,
  transcript: transcriptInitialState,
  framework: viewerInitialState,
  sgAudio: sgAudioInitialState,
  graphs: graphInitialState,
  user: userInitialState,
};

const sliceReducers = combineReducers({
  sequences: sequencesSlice.reducer,
  videos: videoSlice.reducer,
  photos: photoSlice.reducer,
  ephemera: ephemeraSlice.reducer,
  dayNight: dayNightSlice.reducer,
  gps: gpsSlice.reducer,
  transcript: transcriptSlice.reducer,
  framework: frameworkSlice.reducer,
  sgAudio: sgAudioSlice.reducer,
  graphs: graphSlice.reducer,
  user: userSlice.reducer,
});
export type RootState = ReturnType<typeof sliceReducers>;

export const store: StoreType = configureStore({
  reducer: sliceReducers,
  preloadedState: initialState,
  devTools: {
    name: `CODA Tab-${Math.random()}`, // Include git branch name
  },
});
export type StoreType = ReturnType<typeof configureStore<RootState>>;
export type AppDispatch = typeof store.dispatch;

export default store;
