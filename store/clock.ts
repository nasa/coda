import { createSelector, createSlice } from "@reduxjs/toolkit";

export interface Activation {
  GMT: Date;
  localTime: Date;
  go: Boolean;
}

export const initialState = {
  history: [] as Activation[],
};

export const clockSlice = createSlice({
  name: "clock",
  initialState,
  reducers: {
    /**
     * Set the current GMT of the application clock
     */
    start: (state, action) => {
      const activation: Activation = {
        GMT: action.payload,
        localTime: new Date(),
        go: true,
      };
      state.history.push(activation);
    },
  },
});

export const { start } = clockSlice.actions;

const historySelector = (state) => state.history;

/**
 * Get the current clock settings
 */
export const currentClockSelector = createSelector(
  historySelector,
  (history): Activation => history[history.length - 1] || null
);
