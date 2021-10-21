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
  title: string;
  source: string;
  state?: any;
}

export interface Frames {
  [key: number]: Frame;
}

export const allFrames: Frames = {
  0: {
    title: "ISS Video Downlink",
    source: "iss",
  },
  1: {
    title: "ISS Video Non-Downlink",
    source: "iss",
  },
  2: {
    title: "ISS Photography",
    source: "iss",
  },
  3: {
    title: "ISS Groundtrack",
    source: "iss",
  },
  4: {
    title: "EVA Info",
    source: "iss",
  },
  5: {
    title: "DOUG",
    source: "iss",
  },
  6: {
    title: "ISS Telemetry",
    source: "iss",
  },
};

export interface ViewerState {
  /** Currently supports `iss` or `test-events` */
  selectedSource: string;
  /** Number representing the layout ID */
  layout: number;
  /** Current mapping of visible frames to Frame types */
  frames: {
    [key: number]: number;
  };
}

export const initialState: ViewerState = {
  layout: 0,
  frames: {},
  selectedSource: "iss",
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

    /**
     * Select the type of frame to render in a frame
     */
    selectFrameType: (state, action: { payload: { frameID: number; frameTypeID: number } }) => {
      state.frames[action.payload.frameID] = action.payload.frameTypeID;
    },
  },
});

export const { changeLayout, selectFrameType } = viewerSlice.actions;
