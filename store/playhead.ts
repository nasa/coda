import { createSlice } from "@reduxjs/toolkit";

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

/**
 * Whether a date is between two other dates in UTC
 * @param target Date in question
 * @param start Beginning bounds date
 * @param end Ending bounds date
 * @returns boolean
 */
export const isBetweenDates = (target: Date, start: Date, end: Date): boolean => {
  const targetUTC = getUTCDate(target);
  const startUTC = getUTCDate(start);
  const endUTC = getUTCDate(end);

  return targetUTC.getTime() >= startUTC.getTime() && targetUTC.getTime() <= endUTC.getTime();
};

/**
 * Convert a Date to UTC
 */
function getUTCDate(target: Date): Date {
  return new Date(
    Date.UTC(
      target.getUTCFullYear(),
      target.getUTCMonth(),
      target.getUTCDate(),
      target.getUTCHours(),
      target.getUTCMinutes(),
      target.getUTCSeconds()
    )
  );
}
