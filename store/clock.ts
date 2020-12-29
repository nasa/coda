import moment from "moment";
import { createSelector, createSlice } from "@reduxjs/toolkit";

export interface ClockState {
  history: Activation[];
}

export interface Activation {
  /** Whether or not the application clock should be ticking */
  go: Boolean;
  /** ISO string */
  localTime: string;
  /** ISO string */
  GMT?: string;
}

export const initialState: ClockState = {
  history: [],
};

export const clockSlice = createSlice({
  name: "clock",
  initialState,
  reducers: {
    /**
     * Set the current GMT of the application clock
     */
    start: (state, action: { payload: string }) => {
      const activation: Activation = {
        go: true,
        localTime: new Date().toISOString(),
        // convert to Date and back to make sure it's a valid ISO string
        GMT: new Date(action.payload).toISOString(),
      };
      state.history.push(activation);
    },

    /** Stop the application clock */
    stop: (state, action: { payload: string }) => {
      state.history.push({
        go: false,
        localTime: new Date().toISOString(),
      });
    },
  },
});

export const { start } = clockSlice.actions;

export const historySelector = (state) => state.history;

/**
 * Get the current clock settings
 */
export const currentClockSelector = createSelector(
  historySelector,
  (history: Activation[]): Activation => history[history.length - 1] || null
);

/**
 * Get the current application UTC
 */
export const getApplicationUTC = (history: Activation[]): Date => {
  // lastStopTime must be undefined for `moment(lastStopTime)` to either return a moment representing the lastStopTime or a moment representing now
  let lastStopTime;
  let lastGMT = null;

  // iterate backwards to figure out the current application GMT
  for (let h = history.length - 1; h >= 0; h--) {
    const { go, localTime, GMT } = history[h];
    if (go) {
      const delta = moment(lastStopTime).diff(moment(localTime));
      return moment(GMT).add(delta).toDate();
    }
    lastStopTime = localTime;
    lastGMT = GMT;
  }
  // the application must not have ever started
  return lastGMT;
};

/**
 * Get the current mission time in seconds
 */
export const getMissionTime = (history: Activation[]): number => {
  // lastStopTime must be undefined for `moment(lastStopTime)` to either return a moment representing the lastStopTime or a moment representing now
  let lastStopTime;

  // iterate backwards to figure out the current application GMT
  for (let h = history.length - 1; h >= 0; h--) {
    const { go, localTime, GMT } = history[h];
    if (go) {
      const delta = moment(lastStopTime).diff(moment(localTime));
      const updated = moment(GMT).add(delta);
      return (
        updated.hours() * 3600 + updated.minutes() * 60 + updated.seconds()
      );
    }
    lastStopTime = localTime;
  }
  // the application must not have ever started
  return 0;
};
