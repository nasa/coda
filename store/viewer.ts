/** The state of the application viewer */

import { createSlice } from "@reduxjs/toolkit";

/** Definition of all possible layouts */
export interface Layouts {
  [key: number]: {
    svg: string;
    frames: number;
  };
}

export const allLayouts: Layouts = {
  0: {
    svg: "/icons/layout1.svg",
    frames: 6,
  },
  1: {
    svg: "/icons/layout1.svg",
    frames: 1,
  },
  2: {
    svg: "/icons/layout1.svg",
    frames: 2,
  },
};

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
