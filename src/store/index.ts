import { combineReducers, configureStore, isRejected } from "@reduxjs/toolkit";
import { sequencesSlice, initialState as sequencesInitialState } from "./sequences";
import { videoSlice, initialState as videosInitialState } from "./videos";
import { frameworkSlice, initialState as viewerInitialState } from "./framework";
import { photoSlice, initialState as photosInitialState } from "./photos";
import { ephemeraSlice, initialState as ephemeraInitialState } from "./ephemera";
import { dayNightSlice, initialState as dayNightInitialState } from "./daynight";
import { gpsSlice, initialState as gpsInitialState } from "./gps";
import { talkybotSlice, initialState as talkybotInitialState } from "./talkybot";
import { graphSlice, initialState as graphInitialState } from "./graphs";
import { pcdAudioSlice, initialState as pcdAudioInitialState } from "./pcdAudio";
import { userSlice, initialState as userInitialState } from "./user";
import { clockSlice, initialState as clockInitialState } from "./clock";
import type { Middleware } from "@reduxjs/toolkit";

export const initialState = {
  sequences: sequencesInitialState,
  videos: videosInitialState,
  photos: photosInitialState,
  ephemera: ephemeraInitialState,
  dayNight: dayNightInitialState,
  gps: gpsInitialState,
  framework: viewerInitialState,
  talkybot: talkybotInitialState,
  graphs: graphInitialState,
  pcdAudio: pcdAudioInitialState,
  user: userInitialState,
  clock: clockInitialState,
};

const sliceReducers = combineReducers({
  sequences: sequencesSlice.reducer,
  videos: videoSlice.reducer,
  photos: photoSlice.reducer,
  ephemera: ephemeraSlice.reducer,
  dayNight: dayNightSlice.reducer,
  gps: gpsSlice.reducer,
  framework: frameworkSlice.reducer,
  talkybot: talkybotSlice.reducer,
  graphs: graphSlice.reducer,
  pcdAudio: pcdAudioSlice.reducer,
  user: userSlice.reducer,
  clock: clockSlice.reducer,
});
export type RootState = ReturnType<typeof sliceReducers>;

// Add middleware to log rejected thunks to the browser console
const rejectedActionLogger: Middleware<{}, RootState> = () => (next) => (action) => {
  if (isRejected(action)) {
    console.error("Rejected async thunk. Action = ", { action });
  }
  return next(action);
};

export const store: StoreType = configureStore({
  reducer: sliceReducers,
  preloadedState: initialState,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(rejectedActionLogger),
  devTools: {
    name: `CODA Tab-${Math.random()}`, // Include git branch name
  },
});
export type StoreType = ReturnType<typeof configureStore<RootState>>;
export type AppDispatch = typeof store.dispatch;

export default store;
