/** The state of the application viewer */

import _ from "lodash";
import { createSlice } from "@reduxjs/toolkit";
import { Source } from "utils/enums";

/**
 * Supporting information about each layout defined in components/layouts.modules.css.
 * The letters in this object refer to the CSS grid definitions in components/layouts.modules.css.
 * Letters should never be changed per layout in order for shared links to always refer to the correct layout.
 * Ordering of the layouts in this object represent the order they appear in the dropdown. Dropdown order does not have to be alphabetical.
 */
export const allLayouts: Layouts = {
  a: {
    frameCount: 5,
    cssGridRows: 9,
  },
  b: {
    frameCount: 6,
    cssGridRows: 9,
  },
  c: {
    frameCount: 5,
    cssGridRows: 9,
  },
  d: {
    frameCount: 4,
    cssGridRows: 9,
  },
  e: {
    frameCount: 4,
    cssGridRows: 9,
  },
  f: {
    frameCount: 9,
    cssGridRows: 9,
  },
  g: {
    frameCount: 6,
    cssGridRows: 10,
  },
  h: {
    frameCount: 1,
    cssGridRows: 9,
  },
  i: {
    frameCount: 3,
    cssGridRows: 9,
  },
};

export const allPanes: Panes = {
  empty: {
    title: "Select display type",
    icon: "none",
    color: "none",
    defaultPaneStateData: {
      ready: true,
    },
  },
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
      showHelp: false,
    } as VideoPaneStateData,
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
      showHelp: false,
    } as VideoPaneStateData,
  },
  photo: {
    title: "Photography",
    icon: "camera",
    color: "mustardGreen",
    defaultPaneStateData: {
      ready: true,
      showInfo: false,
      showFilter: false,
      showHelp: false,
    } as PhotoPaneStateData,
  },
  iss_location: {
    title: "ISS Position",
    icon: "globe-americas",
    color: "purple",
    defaultPaneStateData: {
      ready: true,
      lockMap: true,
      showHelp: false,
    } as LocationPaneStateData,
  },
  gps_location: {
    title: "GPS Position",
    icon: "globe-americas",
    color: "purple",
    defaultPaneStateData: {
      ready: true,
      lockMap: true,
      showHelp: false,
    } as LocationPaneStateData,
  },
  event_info: {
    title: "EVA Info",
    icon: "info",
    color: "ruby",
    defaultPaneStateData: {
      ready: true,
      showHelp: false,
    } as EventPaneStateData,
  },
};

export const defaultFrames: FrameState = {
  1: {
    paneType: "video_downlink",
    paneStateData: {
      ready: true,
      downlink: 0,
      activeVideoFileID: "",
      muted: false,
      showInfo: false,
    } as VideoPaneStateData,
  },
  2: {
    paneType: "video_non_downlink",
    paneStateData: {
      ready: true,
      downlink: -1,
      activeVideoFileID: "",
      muted: false,
      showInfo: false,
    } as VideoPaneStateData,
  },
  3: {
    paneType: "photo",
    paneStateData: {
      ready: true,
      showInfo: false,
      showFilter: false,
    } as PhotoPaneStateData,
  },
  4: {
    paneType: "event_info",
    paneStateData: {
      ready: true,
    } as EventPaneStateData,
  },
  5: {
    paneType: "iss_location",
    paneStateData: {
      lockMap: true,
      ready: true,
    } as LocationPaneStateData,
  },
};

/**
 * The state of each frame containing the pane type and the state of the control
 * NOTE: all panes must manage a "ready" boolean in its paneStateData. This is used to determine application-wide readiness
 */
export const initialState: FrameworkState = {
  layout: "a",
  frames: defaultFrames,
  source: Source.ISS,
};

export const frameworkSlice = createSlice({
  name: "framework",
  initialState,
  reducers: {
    /**
     * Change the component layout
     */
    changeLayout: (state, action: { payload: string }) => {
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
     * Set the state of all frames. Used when state is sent in on a query parameter
     */
    setAllFrameworkState: (state, action: { payload: FrameworkState }) => {
      state.source = action.payload.source;
      allPanes["event_info"].title = getEventInfoTitleBySource(action.payload.source);
      state.layout = action.payload.layout;
      state.frames = action.payload.frames;
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
      state.source = action.payload;
      state.frames = defaultFrames;
      allPanes["event_info"].title = getEventInfoTitleBySource(action.payload);
    },
  },
});

export const {
  changeLayout,
  setPaneType,
  setAllFrameworkState,
  setPaneStateDataValue,
  changeSource,
} = frameworkSlice.actions;

function getEventInfoTitleBySource(source: Source): string {
  if (source === Source.ISS) {
    return "EVA Info";
  } else if (source === Source.NBL) {
    return "NBL Event Info";
  } else if (source === Source.TEST_EVENTS) {
    return "Test Event Info";
  }
}
