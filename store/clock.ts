import moment from "moment";
import { createSelector, createSlice } from "@reduxjs/toolkit";

export interface ClockState {
  /** Whether the clock actually is running */
  isRunning: boolean;
  /** Whether the user wants the clock to be running */
  ready: boolean;
  /** ISO string for the last start in the application timeframe */
  applicationTime: string;
  /** ISO string when the clock was started */
  lastStarted: string;
  /** ISO string when the clock was last stopped */
  lastStopped: string;
}

export const initialState: ClockState = {
  isRunning: true,
  // assume a user wants the timeline to play as soon as they load the application
  ready: true,
  applicationTime: null,
  lastStarted: null,
  lastStopped: null,
};

export const clockSlice = createSlice({
  name: "clock",
  initialState,
  reducers: {
    /**
     * The user lets us know the clock is ready to run or not
     */
    toggleReady: (state) => {
      state.ready = !state.ready;
    },

    /**
     * Set the current UTC of the application clock
     */
    set: (state, action: { payload: string }) => {
      // convert to Date and back to make sure it's a valid ISO string
      state.applicationTime = new Date(action.payload).toISOString();
    },

    /**
     * Start the application clock
     */
    start: (state) => {
      state.lastStarted = new Date().toISOString();
      state.lastStopped = null;
      state.isRunning = true;
    },

    /**
     * Stop the application clock
     */
    stop: (state) => {
      state.lastStopped = new Date().toISOString();
      state.isRunning = false;
    },
  },
});

export const { set, start, stop, toggleReady } = clockSlice.actions;

/** Utility for doing the math to determine the internal application time based on starts and stops of the clock. Exported for testing */
export const getApplicationTime = (state: ClockState): moment.Moment => {
  const { isRunning, lastStarted, lastStopped, applicationTime } = state;

  // the application has never run
  if (!applicationTime) {
    // TODO: maybe return the earliest time we have timing data for?
    return null;
  }

  const delta = isRunning
    ? moment().diff(moment(lastStarted))
    : moment(lastStopped).diff(moment(lastStarted));

  return moment(applicationTime).add(delta);
};

/**
 * Get the current application UTC
 */
export const getApplicationUTC = (state: ClockState): Date => {
  const time = getApplicationTime(state);
  if (time) {
    return time.toDate();
  }

  return null;
};

/**
 * Get the current mission time in seconds
 */
export const getMissionTime = (state: ClockState): number => {
  const time = getApplicationTime(state);
  if (time) {
    return time.hours() * 3600 + time.minutes() * 60 + time.seconds();
  }

  return 0;
};
