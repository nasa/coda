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
     * Make the application clock run
     */
    run: (state) => {
      state.applicationTime = getApplicationUTC(state)?.toISOString() || null;
      state.lastStarted = new Date().toISOString();
      state.isRunning = true;
    },

    /**
     * Make the application clock stop running
     */
    halt: (state) => {
      if (state.isRunning) {
        state.lastStopped = new Date().toISOString();
        state.isRunning = false;
      }
    },

    /**
     * The user is ready for the clock to run
     */
    start: (state) => {
      state.ready = true;
    },

    /**
     * The user wants the clock to stop
     */
    stop: (state) => {
      state.ready = false;
    },
  },
});

export const { start, stop, set, run, halt, toggleReady } = clockSlice.actions;

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

const getMS = (d: Date): number => {
  const Y = d.getUTCFullYear();
  const M = d.getUTCMonth();
  const D = d.getUTCDate();
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const s = d.getUTCSeconds();
  const ms = d.getUTCMilliseconds();
  return Date.UTC(Y, M, D, h, m, s, ms);
};

/**
 * Get the number of milliseconds between two dates, equivalent to `a - b`
 */
export const diff = (a: Date, b: Date): number => {
  return getMS(a) - getMS(b);
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
