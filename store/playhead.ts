import { createSlice } from "@reduxjs/toolkit";
import { midnightZulu } from "utils/date";

export const initialState: PlayheadState = {
  // assume a 08:00:00Z start
  seconds: 8 * 60 * 60,
  date: null,
  isRunning: false,
  ready: false,
};

export const playheadSlice = createSlice({
  name: "playhead",
  initialState,
  reducers: {
    /**
     * Bump the playhead up by 1 second
     */
    tick: (state) => {
      state.seconds += 1;
    },

    /**
     * Change the date the application is rendering
     */
    changeDate: (state, action: { payload: string }) => {
      const date = new Date(action.payload);
      state.date = midnightZulu(date).toISOString();
    },

    /**
     * Change the date the application is rendering
     */
    changeTime: (state, action: { payload: number }) => {
      state.seconds = action.payload;
    },

    /**
     * Make the application playhead run
     */
    run: (state) => {
      state.isRunning = true;
    },

    /**
     * Make the application playhead stop running
     */
    halt: (state) => {
      if (state.isRunning) {
        state.isRunning = false;
      }
    },

    /**
     * The user is ready for the playhead to run
     */
    start: (state) => {
      state.ready = true;
    },

    /**
     * The user wants the playhead to stop
     */
    stop: (state) => {
      state.ready = false;
    },
  },
});

export const { tick, changeDate, changeTime, start, stop, run, halt } = playheadSlice.actions;
