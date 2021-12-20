/** The state of the application viewer */

import { createSlice } from "@reduxjs/toolkit";
import { FrameSource } from "utils/enums";

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
  iss_downlink: {
    source: FrameSource.ISS,
    title: "ISS Video Downlink",
    icon: "video",
    color: "teal",
  },
  iss_non_downlink: {
    source: FrameSource.ISS,
    title: "ISS Video Non-Downlink",
    icon: "video",
    color: "teal",
  },
  iss_photo: {
    source: FrameSource.ISS,
    title: "ISS Photography",
    icon: "camera",
    color: "ruby",
  },
  iss_groundtrack: {
    source: FrameSource.ISS,
    title: "ISS Groundtrack",
    icon: "globe-americas",
    color: "purple",
  },
  iss_eva_info: {
    source: FrameSource.ISS,
    title: "EVA Info",
    icon: "info",
    color: "mustardGreen",
  },
  iss_doug: {
    source: FrameSource.ISS,
    title: "DOUG",
    // maybe table-cells?
    icon: "layer-group",
    color: "mustardGreen",
  },
  iss_telemetry: {
    source: FrameSource.ISS,
    title: "ISS Telemetry",
    // arrow-trend-up
    icon: "chart-line",
    color: "mustardGreen",
  },
};

export const initialState: ViewerState = {
  layout: 0,
  frames: {},
  selectedSource: FrameSource.ISS,
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
    selectFrameType: (state, action: { payload: { frameID: number; frameType: string } }) => {
      if (typeof state.frames[action.payload.frameID] !== "undefined") {
        state.frames[action.payload.frameID].frameType = action.payload.frameType;
      } else {
        const newFrameState: FrameState = {
          frameType: action.payload.frameType,
        };
        state.frames[action.payload.frameID] = newFrameState;
      }
    },
  },
});

export const { changeLayout, selectFrameType } = viewerSlice.actions;
