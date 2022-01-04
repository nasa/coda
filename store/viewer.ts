/** The state of the application viewer */

import _ from "lodash";
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
    defaultPaneStateData: {
      ready: true,
      downlink: 0,
      activeVideoFileID: "",
      muted: false,
      showInfo: false,
    },
  },
  iss_non_downlink: {
    source: FrameSource.ISS,
    title: "ISS Video Non-Downlink",
    icon: "video",
    color: "teal",
    defaultPaneStateData: {
      ready: true,
    },
  },
  iss_photo: {
    source: FrameSource.ISS,
    title: "ISS Photography",
    icon: "camera",
    color: "ruby",
    defaultPaneStateData: {
      ready: true,
      infoToggle: false,
      infoHover: false,
      filterToggle: false,
    },
  },
  iss_groundtrack: {
    source: FrameSource.ISS,
    title: "ISS Groundtrack",
    icon: "globe-americas",
    color: "purple",
    defaultPaneStateData: {
      ready: true,
      lockToggle: true,
    },
  },
  iss_eva_info: {
    source: FrameSource.ISS,
    title: "EVA Info",
    icon: "info",
    color: "mustardGreen",
    defaultPaneStateData: {
      ready: true,
    },
  },
  iss_doug: {
    source: FrameSource.ISS,
    title: "DOUG",
    // maybe table-cells?
    icon: "layer-group",
    color: "mustardGreen",
    defaultPaneStateData: {
      ready: true,
    },
  },
  iss_telemetry: {
    source: FrameSource.ISS,
    title: "ISS Telemetry",
    // arrow-trend-up
    icon: "chart-line",
    color: "mustardGreen",
    defaultPaneStateData: {
      ready: true,
    },
  },
};

/**
 * The state of each frame containing the pane type and the state of the control
 * NOTE: all panes must manage a "ready" boolean in its controlStateData. This is used to determine application-wide readiness
 */
export const initialState: ViewerState = {
  layout: 0,
  frames: {
    1: {
      paneType: "iss_downlink",
      paneStateData: {
        ready: true,
        downlink: 0,
        activeVideoFileID: "",
        muted: false,
        showInfo: false,
      },
    },
    2: {
      paneType: "iss_photo",
      paneStateData: {
        ready: true,
        infoToggle: false,
        infoHover: false,
        filterToggle: false,
      },
    },
    5: {
      paneType: "iss_groundtrack",
      paneStateData: {
        lockToggle: true,
        ready: true,
      },
    },
  },
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
      state.frames[action.payload.frameID] = {
        paneType: action.payload.paneType,
        /* Set the pane state to the default state for this paneType */
        paneStateData: allPanes[action.payload.paneType].defaultPaneStateData,
      };
    },
    setPaneStateDataValue: (
      state,
      action: { payload: { frameID: number; paneStateProperty: string; paneStateValue: any } }
    ) => {
      state.frames[action.payload.frameID].paneStateData[action.payload.paneStateProperty] =
        action.payload.paneStateValue;
    },
  },
});

export const { changeLayout, setPaneType, setPaneStateDataValue } = viewerSlice.actions;
