import { createSlice } from "@reduxjs/toolkit";

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
      state.applicationTime = getApplicationUTC(state)?.toISOString() || null;
      state.lastStarted = new Date().toISOString();
      state.isRunning = true;
    },

    /**
     * Stop the application clock
     */
    stop: (state) => {
      if (state.isRunning) {
        state.lastStopped = new Date().toISOString();
        state.isRunning = false;
      }
    },
  },
});

export const { set, start, stop, toggleReady } = clockSlice.actions;

/** Utility for doing the math to determine the internal application time based on starts and stops of the clock. Exported for testing */
export const getApplicationUTC = (state: ClockState): Date => {
  const { isRunning, lastStarted, lastStopped, applicationTime } = state;

  // the application has never run
  if (!applicationTime) {
    // TODO: maybe return the earliest time we have timing data for?
    return null;
  }

  const now = new Date();
  const delta = isRunning
    ? diff(now, new Date(lastStarted))
    : diff(new Date(lastStopped), new Date(lastStarted));

  return add(new Date(applicationTime), delta);
};

/**
 * Get the current mission time in UTC seconds
 */
export const getMissionTime = (state: ClockState): number => {
  const time = getApplicationUTC(state);
  if (time) {
    return time.getUTCHours() * 3600 + time.getUTCMinutes() * 60 + time.getUTCSeconds();
  }

  return 0;
};

/**
 * Get the number of milliseconds between two dates, equivalent to `a - b`
 */
const diff = (a: Date, b: Date): number => {
  const Y1 = a.getUTCFullYear();
  const M1 = a.getUTCMonth();
  const D1 = a.getUTCDay();
  const h1 = a.getUTCHours();
  const m1 = a.getUTCMinutes();
  const s1 = a.getUTCSeconds();
  const ms1 = a.getUTCMilliseconds();

  const Y2 = b.getUTCFullYear();
  const M2 = b.getUTCMonth();
  const D2 = b.getUTCDay();
  const h2 = b.getUTCHours();
  const m2 = b.getUTCMinutes();
  const s2 = b.getUTCSeconds();
  const ms2 = b.getUTCMilliseconds();

  return Date.UTC(Y1, M1, D1, h1, m1, s1, ms1) - Date.UTC(Y2, M2, D2, h2, m2, s2, ms2);
};

/**
 * Advance a Date by some number of milliseconds
 */
const add = (d: Date, ms: number): Date => {
  const ret = new Date(d);
  const currentMS = ret.getUTCMilliseconds();
  ret.setUTCMilliseconds(currentMS + ms);
  return ret;
};
