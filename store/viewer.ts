/** The state of the application viewer */

import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { createSlice } from "@reduxjs/toolkit";

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

export const allFrames: Frames = {
  0: {
    source: "iss",
    title: "ISS Video Downlink",
    icon: "video",
    color: "teal",
  },
  1: {
    source: "iss",
    title: "ISS Video Non-Downlink",
    icon: "video",
    color: "teal",
  },
  2: {
    source: "iss",
    title: "ISS Photography",
    icon: "camera",
    color: "ruby",
  },
  3: {
    source: "iss",
    title: "ISS Groundtrack",
    icon: "globe-americas",
    color: "purple",
  },
  4: {
    source: "iss",
    title: "EVA Info",
    icon: "info",
    color: "mustardGreen",
  },
  5: {
    source: "iss",
    title: "DOUG",
    // maybe table-cells?
    icon: "layer-group",
    color: "mustardGreen",
  },
  6: {
    source: "iss",
    title: "ISS Telemetry",
    // arrow-trend-up
    icon: "chart-line",
    color: "mustardGreen",
  },
};

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
