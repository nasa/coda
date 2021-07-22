/** The state of the application viewer */

import { createSlice } from "@reduxjs/toolkit";

/** Definition of all possible layouts */
export interface Layouts {
  [key: number]: {
    svg: string;
    frameCount: number;
  };
}

export const allLayouts: Layouts = {
  0: {
    svg: "/icons/layout1.svg",
    frameCount: 6,
  },
  1: {
    svg: "/icons/layout1.svg",
    frameCount: 1,
  },
  2: {
    svg: "/icons/layout1.svg",
    frameCount: 2,
  },
};

export interface Frame {
  type?: string;
  source?: string;
}

export interface ViewerState {
  /** Number representing the layout ID */
  layout: number;
  frames: {
    [key: number]: Frame;
  };
}

export const initialState: ViewerState = {
  layout: 0,
  frames: {
    1: {},
    2: {},
    3: {},
    4: {},
    5: {},
    6: {},
  },
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
