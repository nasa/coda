import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { clockSlice } from "./clock";
import { videoSlice } from "./videos";

export const store = configureStore({
  reducer: combineReducers({
    clock: clockSlice.reducer,
    videos: videoSlice.reducer,
  }),
});
