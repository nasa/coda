/** The state of the application viewer */

import { createSlice } from "@reduxjs/toolkit";

export const allLayouts = [
  "/icons/layout1.svg", // all one frame
  "/icons/layout1.svg",
  "/icons/layout1.svg",
  "/icons/layout1.svg",
  "/icons/layout1.svg",
  "/icons/layout1.svg",
  "/icons/layout1.svg",
  "/icons/layout1.svg",
  "/icons/layout1.svg",
  "/icons/layout1.svg",
];

export interface ViewerState {
  /** Number representing the layout ID */
  layout: number;
}

export const initialState: ViewerState = {
  layout: 0,
};

export const viewerSlice = createSlice({
  name: "viewer",
  initialState,
  reducers: {
    /**
     * Change the component layout
     */
    changeLayout: (state, action: { payload: number }) => {
      state.layout = action.payload;
    },
  },
});

export const { changeLayout } = viewerSlice.actions;
