import { createSlice } from "@reduxjs/toolkit";

export interface PlayheadState {
  /** Seconds representing the time into the mission day, eg. `0` is 00:00:00Z, `86399` is 23:59:59Z */
  seconds: number;
  /** UTC date being viewed */
  date: string;
  /** Whether the playhead actually is running */
  isRunning: boolean;
  /** Whether the user wants the playhead to be running */
  ready: boolean;
}

export const initialState: PlayheadState = {
  // assume a 00:00:00Z start
  seconds: 0,
  date: null,
  isRunning: true,
  // assume a user wants the timeline to play as soon as they load the application
  ready: true,
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
      state.date = midnightZulu(date).toUTCString();
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

export const midnightZulu = (d: Date): Date => {
  d.setUTCHours(0);
  d.setUTCMinutes(0);
  d.setUTCSeconds(0);
  d.setUTCMilliseconds(0);
  return d;
};

const getMS = (d: Date): number => {
  // TODO: isn't this just Date.prototype.getTime()?
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
export const add = (d: Date, ms: number): Date => {
  const ret = new Date(d);
  const currentMS = ret.getUTCMilliseconds();
  ret.setUTCMilliseconds(currentMS + ms);
  return ret;
};

/**
 * Whether or not two dates are the same UTC date
 */
export const isSameDate = (a: Date, b: Date): boolean => {
  const Y1 = a.getUTCFullYear();
  const M1 = a.getUTCMonth();
  const D1 = a.getUTCDate();

  const Y2 = b.getUTCFullYear();
  const M2 = b.getUTCMonth();
  const D2 = b.getUTCDate();

  return Y1 === Y2 && M1 === M2 && D1 === D2;
};
