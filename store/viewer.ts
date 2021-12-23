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

export const allPanes: Frames = {
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
    setPaneType: (state, action: { payload: { frameID: number; paneType: string } }) => {
      if (typeof state.frames[action.payload.frameID] !== "undefined") {
        state.frames[action.payload.frameID].paneType = action.payload.paneType;
      } else {
        const newFrameState: FrameState = {
          paneType: action.payload.paneType,
          controlStateData: {},
        };
        state.frames[action.payload.frameID] = newFrameState;
      }
    },
    setControlStateData: (
      state,
      action: { payload: { frameID: number; controlStateData: any } }
    ) => {
      state.frames[action.payload.frameID].controlStateData = action.payload.controlStateData;
    },
  },
});

export const { changeLayout, setPaneType, setControlStateData } = viewerSlice.actions;
