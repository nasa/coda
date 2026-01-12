import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { isSameDate } from "utils/date";
import { appSecondsFromDateString } from "utils/formatting";

export const initialState: ClockState = {
  /** UTC date being viewed (YYYY-MM-DD format or full ISO string) */
  date: null,
  /** Timestamp of the last start/stop user event */
  startStopTimestamp: null,
  /** The appSeconds value when the clock was last started or stopped */
  appSecondsAtStartStop: 28800, // 08:00:00Z default
  /** Whether the clock is currently running */
  isRunning: false,
  /** Hover playhead seconds (for timeline hover indicators) */
  hoverSeconds: null,
};

export const clockSlice = createSlice({
  name: "clock",
  initialState,
  reducers: {
    /** Set the date being viewed */
    setDate: (state, action: PayloadAction<string | null>) => {
      state.date = action.payload;
    },

    /** Set the app seconds (when clock is stopped or being scrubbed) */
    setAppSeconds: (state, action: PayloadAction<number>) => {
      const now = new Date();
      const nowSeconds = appSecondsFromDateString(now.toISOString());

      // Prevent setting time to the future if viewing today
      let newSeconds = action.payload;
      if (state.date && isSameDate(new Date(state.date), now)) {
        newSeconds = Math.min(action.payload, nowSeconds);
      }

      state.appSecondsAtStartStop = newSeconds;
      state.startStopTimestamp = now.toISOString();
    },

    /** Start the clock running */
    startClock: (state) => {
      state.isRunning = true;
      state.startStopTimestamp = new Date().toISOString();
    },

    /** Stop the clock */
    stopClock: (state) => {
      // Calculate current appSeconds before stopping
      if (state.startStopTimestamp) {
        const elapsedSeconds = (Date.now() - Date.parse(state.startStopTimestamp)) / 1000;
        state.appSecondsAtStartStop = Math.floor(state.appSecondsAtStartStop + elapsedSeconds);
      }
      state.isRunning = false;
      state.startStopTimestamp = new Date().toISOString();
    },

    /** Toggle the clock running state */
    toggleClock: (state) => {
      if (state.isRunning) {
        // Stopping - calculate current appSeconds
        if (state.startStopTimestamp) {
          const elapsedSeconds = (Date.now() - Date.parse(state.startStopTimestamp)) / 1000;
          state.appSecondsAtStartStop = Math.floor(state.appSecondsAtStartStop + elapsedSeconds);
        }
        state.isRunning = false;
      } else {
        // Starting
        state.isRunning = true;
      }
      state.startStopTimestamp = new Date().toISOString();
    },

    /** Set the hover playhead seconds */
    setHoverSeconds: (state, action: PayloadAction<number | null>) => {
      state.hoverSeconds = action.payload;
    },

    /** Reset clock to initial state */
    resetClock: () => initialState,
  },
});

export const {
  setDate,
  setAppSeconds,
  startClock,
  stopClock,
  toggleClock,
  setHoverSeconds,
  resetClock,
} = clockSlice.actions;
