import { createSlice } from "@reduxjs/toolkit";

export interface PlayheadHoverState {
  /** Seconds representing the time into the mission day that the mouse is hovering on via the nav-timeline */
  seconds: number;
}

export const initialState: PlayheadHoverState = {
  seconds: 0,
};

export const playheadHoverSlice = createSlice({
  name: "playheadHover",
  initialState,
  reducers: {
    /**
     * Change the date the cursor is hovering on via the nav-timeline
     */
    changeHoverTime: (state, action: { payload: number }) => {
      state.seconds = action.payload;
    },
  },
});

export const { changeHoverTime } = playheadHoverSlice.actions;
