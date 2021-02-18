import { useMemo } from "react";
import { combineReducers, configureStore, getDefaultMiddleware } from "@reduxjs/toolkit";
import { clockSlice, initialState as clockInitialState } from "./clock";
import { evasSlice, initialState as evasInitialState } from "./evas";
import { videoSlice, initialState as videosInitialState } from "./videos";
import { photoSlice } from "./photos";

let store;

const initialState = {
  clock: clockInitialState,
  evas: evasInitialState,
  videos: videosInitialState,
};

// server-side redux technique adapted from https://github.com/vercel/next.js/blob/canary/examples/with-redux/store.js#L50

const initStore = (preloadedState = initialState) => {
  const store = configureStore({
    reducer: combineReducers({
      clock: clockSlice.reducer,
      evas: evasSlice.reducer,
      videos: videoSlice.reducer,
      photos: photoSlice.reducer,
    }),
    preloadedState,
    devTools: true,
    middleware: [...getDefaultMiddleware({ immutableCheck: false })],
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
