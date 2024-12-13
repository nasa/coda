import { createSlice } from "@reduxjs/toolkit";
import { isSameDate, midnightZulu } from "../utils/date";
import { appSecondsFromDateString } from "utils/formatting";

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

      // if the date is not in the future, set it, else set it to today
      if (date.getTime() < Date.now()) {
        state.date = midnightZulu(date).toISOString();
      } else {
        state.date = midnightZulu(new Date()).toISOString();
      }
    },

    /**
     * Change the date the application is rendering
     */
    changeTime: (state, action: { payload: number }) => {
      // if it's today, dont allow the time to be set in the future
      const isToday = isSameDate(new Date(), new Date(state.date));
      if (isToday) {
        const currentTimeAppSeconds = appSecondsFromDateString(new Date().toISOString());
        if (action.payload > currentTimeAppSeconds) {
          // if the time is in the future, set it to the current time
          state.seconds = currentTimeAppSeconds;
          return;
        }
      }
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
