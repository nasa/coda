import { useMemo } from "react";
import { combineReducers, configureStore, getDefaultMiddleware } from "@reduxjs/toolkit";
import { playheadSlice, initialState as playheadInitialState } from "./playhead";
import { playheadHoverSlice, initialState as playheadHoverInitialState } from "./playheadHover";
import { sequencesSlice, initialState as sequencesInitialState } from "./sequences";
import { videoSlice, initialState as videosInitialState } from "./videos";
import { photoSlice, initialState as photosInitialState } from "./photos";
import { ephemeraSlice, initialState as ephemeraInitialState } from "./ephemera";
import { ancillarySlice, initialState as ancillaryInitialState } from "./ancillary";

let store;

export const initialState = {
  playhead: playheadInitialState,
  playheadHover: playheadHoverInitialState,
  sequences: sequencesInitialState,
  videos: videosInitialState,
  photos: photosInitialState,
  ephemera: ephemeraInitialState,
  ancillary: ancillaryInitialState,
};

// server-side redux technique adapted from https://github.com/vercel/next.js/blob/canary/examples/with-redux/store.js#L50

const reducer = combineReducers({
  playhead: playheadSlice.reducer,
  playheadHover: playheadHoverSlice.reducer,
  sequences: sequencesSlice.reducer,
  videos: videoSlice.reducer,
  photos: photoSlice.reducer,
  ephemera: ephemeraSlice.reducer,
  ancillary: ancillarySlice.reducer,
});

export type RootState = ReturnType<typeof reducer>;

const initStore = (preloadedState = initialState) => {
  const store = configureStore({
    reducer,
    preloadedState,
    devTools: true,
    middleware: [...getDefaultMiddleware({ immutableCheck: false, serializableCheck: false })],
  });
  return store;
};

export const initializeStore = (preloadedState) => {
  let _store = store ?? initStore(preloadedState);

  // After navigating to a page with an initial Redux state, merge that state
  // with the current state in the store, and create a new store
  if (preloadedState && store) {
    _store = initStore({
      ...store.getState(),
      ...preloadedState,
    });
    // Reset the current store
    store = undefined;
  }

  // For SSG and SSR always create a new store
  if (typeof window === "undefined") return _store;
  // Create the store once in the client
  if (!store) store = _store;

  return _store;
};

export function useStore(initialState) {
  store = useMemo(() => initializeStore(initialState), [initialState]);
  return store;
}
