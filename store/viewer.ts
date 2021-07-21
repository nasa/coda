/** The state of the application viewer */

import { createSlice } from "@reduxjs/toolkit";

/** (row, column) form defining a set of frames in the viewer */
export interface Frames {
  /** Row */
  [key: number]: {
    /** Column */
    [key: number]: {
      /** Numerator width / 12. eg. `12` is 100% width, `6` is 50% width */
      width: number;
      /** Numerator height / 12. eg. `12` is 100% height, `6` is 50% height */
      height: number;
    };
  };
}

/** Definition of all possible layouts */
export interface Layouts {
  [key: number]: {
    svg: string;
    frames: Frames;
  };
}

export const allLayouts: Layouts = {
  0: {
    svg: "/icons/layout1.svg",
    frames: [
      [
        {
          width: 12,
          height: 12,
        },
      ],
    ],
  },
  1: {
    svg: "/icons/layout1.svg",
    frames: [
      [
        {
          width: 6,
          height: 12,
        },
      ],
      [
        {
          width: 6,
          height: 12,
        },
      ],
    ],
  },
  2: {
    svg: "/icons/layout1.svg",
    frames: [
      [
        {
          width: 8,
          height: 12,
        },
      ],
      [
        { width: 4, height: 6 },
        { width: 4, height: 6 },
      ],
    ],
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
