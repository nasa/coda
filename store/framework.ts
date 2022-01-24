/** The state of the application viewer */

import _ from "lodash";
import { createSlice } from "@reduxjs/toolkit";
import { Source } from "utils/enums";

export const allLayouts: Layouts = {
  0: {
    svg: "/icons/layout1.svg",
    frameCount: 6,
    cssGridRows: 9,
  },
  1: {
    svg: "/icons/layout1.svg",
    frameCount: 5,
    cssGridRows: 9,
  },
  2: {
    svg: "/icons/layout1.svg",
    frameCount: 6,
    cssGridRows: 10,
  },
  3: {
    svg: "/icons/layout1.svg",
    frameCount: 1,
    cssGridRows: 9,
  },
};

export const allPanes: Panes = {
  video_downlink: {
    title: "Video Downlink",
    icon: "video",
    color: "teal",
    defaultPaneStateData: {
      ready: false,
      downlink: 0,
      activeVideoFileID: "",
      muted: false,
      showInfo: false,
    },
  },
  video_non_downlink: {
    title: "Video Other",
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
  photo: {
    title: "Photography",
    icon: "camera",
    color: "mustardGreen",
    defaultPaneStateData: {
      ready: true,
      infoToggle: false,
      infoHover: false,
      filterToggle: false,
    },
  },
  iss_position: {
    title: "ISS Position",
    icon: "globe-americas",
    color: "purple",
    defaultPaneStateData: {
      ready: true,
      lockToggle: true,
    },
  },
  event_info: {
    title: "EVA Info",
    icon: "info",
    color: "ruby",
    defaultPaneStateData: {
      ready: true,
    },
  },
};

const defaultFrames = {
  1: {
    paneType: "video_downlink",
    paneStateData: {
      ready: true,
      downlink: 0,
      activeVideoFileID: "",
      muted: false,
      showInfo: false,
    } as VideoPaneControlStateData,
  },
  2: {
    paneType: "video_non_downlink",
    paneStateData: {
      ready: true,
      downlink: -1,
      activeVideoFileID: "",
      muted: false,
      showInfo: false,
    } as VideoPaneControlStateData,
  },
  3: {
    paneType: "photo",
    paneStateData: {
      ready: true,
      showInfo: false,
      showFilter: false,
    } as PhotoPaneControlStateData,
  },
  4: {
    paneType: "event_info",
    paneStateData: {
      ready: true,
    },
  },
  5: {
    paneType: "iss_position",
    paneStateData: {
      lockToggle: true,
      ready: true,
    } as LocationPaneControlStateData,
  },
};

/**
 * The state of each frame containing the pane type and the state of the control
 * NOTE: all panes must manage a "ready" boolean in its controlStateData. This is used to determine application-wide readiness
 */
export const initialState: FrameworkState = {
  layout: 0,
  frames: defaultFrames,
  selectedSource: Source.ISS,
};

export const frameworkSlice = createSlice({
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
    /**
     * Set a state value for use within a pane. The list of available state values depends on the pane type
     */
    setPaneStateDataValue: (
      state,
      action: { payload: { frameID: number; paneStateProperty: string; paneStateValue: any } }
    ) => {
      state.frames[action.payload.frameID].paneStateData[action.payload.paneStateProperty] =
        action.payload.paneStateValue;
    },
    /**
     * Change the overall data source (ISS, Test Events, NBL)
     */
    changeSource: (state, action: { payload: Source }) => {
      state.selectedSource = action.payload;
      state.frames = defaultFrames;
      if (action.payload === Source.ISS) {
        allPanes.event_info.title = "EVA Info";
      } else if (action.payload === Source.NBL) {
        allPanes.event_info.title = "NBL Event Info";
      } else if (action.payload === Source.TEST_EVENTS) {
        allPanes.event_info.title = "Test Event Info";
      }
    },
  },
});

export const {
  changeLayout,
  setPaneType,
  setPaneStateDataValue,
  changeSource,
} = frameworkSlice.actions;
