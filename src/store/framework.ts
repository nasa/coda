/** The state of the application viewer */

import {
  faCamera,
  faChartLine,
  faGlobeAmericas,
  faInfo,
  faSatellite,
  faVideo,
} from "@fortawesome/free-solid-svg-icons";
import { createSlice } from "@reduxjs/toolkit";

/**
 * Supporting information about each layout defined in components/layouts.modules.css.
 * The letters in this object refer to the CSS grid definitions in components/layouts.modules.css.
 * Letters should never be changed per layout in order for shared links to always refer to the correct layout.
 * Ordering of the layouts in this object represent the order they appear in the dropdown.
 * Dropdown order *********does not have to be alphabetical*********.
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
  j: {
    frameCount: 6,
    cssGridRows: 9,
  },
  n: {
    frameCount: 7,
    cssGridRows: 9,
  },
  k: {
    frameCount: 5,
    cssGridRows: 9,
  },
  e: {
    frameCount: 4,
    cssGridRows: 9,
  },
  d: {
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
  l: {
    frameCount: 6,
    cssGridRows: 9,
  },
  m: {
    frameCount: 4,
    cssGridRows: 9,
  },
  h: {
    frameCount: 1,
    cssGridRows: 9,
  },
  i: {
    frameCount: 3,
    cssGridRows: 9,
  },
  o: {
    frameCount: 2,
    cssGridRows: 9,
  },
  p: {
    frameCount: 3,
    cssGridRows: 9,
  },
  q: {
    frameCount: 4,
    cssGridRows: 9,
  },
  r: {
    frameCount: 5,
    cssGridRows: 9,
  },
  s: {
    frameCount: 6,
    cssGridRows: 9,
  },
};

export const allPanes: Panes = {
  empty: {
    title: "Select display type",
    shortTitle: "None",
    icon: undefined,
    color: "none",
    defaultPaneStateData: {
      ready: true,
    },
  },
  video_downlink: {
    title: "Video Channels",
    shortTitle: "Live",
    icon: faVideo,
    color: "teal",
    defaultPaneStateData: {
      ready: true,
      channel: 0,
      activeVideoFileID: "",
      muted: true,
      showInfo: false,
      showHelp: false,
    } as VideoPaneStateData,
  },
  video_non_downlink: {
    title: "Video Other",
    shortTitle: "Video",
    icon: faVideo,
    color: "teal",
    defaultPaneStateData: {
      ready: true,
      channel: -1,
      activeVideoFileID: "",
      muted: true,
      showInfo: false,
      showHelp: false,
    } as VideoPaneStateData,
  },
  photo: {
    title: "Current Photo",
    shortTitle: "Photo",
    icon: faCamera,
    color: "mustardGreen",
    defaultPaneStateData: {
      ready: true,
      showInfo: false,
      showFilter: false,
      showHelp: false,
    } as PhotoPaneStateData,
  },
  photo_all: {
    title: "All Photos",
    shortTitle: "Photos",
    icon: faCamera,
    color: "mustardGreen",
    defaultPaneStateData: {
      ready: true,
      showFilter: false,
      lockScroll: true,
      showHelp: false,
    } as PhotoAllPaneStateData,
  },
  iss_location: {
    title: "ISS Position",
    shortTitle: "Orbit",
    icon: faGlobeAmericas,
    color: "purple",
    defaultPaneStateData: {
      ready: true,
      lockMap: true,
      showHelp: false,
    } as LocationPaneStateData,
  },
  gps_location: {
    title: "GPS Position",
    shortTitle: "GPS",
    icon: faGlobeAmericas,
    color: "purple",
    defaultPaneStateData: {
      ready: true,
      lockMap: true,
      showHelp: false,
      gpsTrackToggles: {},
    } as GpsTrackPaneStateData,
  },
  event_info: {
    title: "EVA Info",
    shortTitle: "Info",
    icon: faInfo,
    color: "ruby",
    defaultPaneStateData: {
      ready: true,
      showHelp: false,
    } as EventPaneStateData,
  },
  comm: {
    title: "Communications",
    shortTitle: "Comms",
    icon: faSatellite,
    color: "burntOrange",
    defaultPaneStateData: {
      ready: true,
      lockScroll: true,
      filterActive: false,
      sgChannels: [],
      isMuted: false,
      showHelp: true,
    } as CommPaneStateData,
  },
  graph: {
    title: "Graph",
    shortTitle: "Graph",
    icon: faChartLine,
    color: "burntUmber",
    defaultPaneStateData: {
      ready: true,
      lockScroll: true,
      showHelp: false,
      selectedGraphId: "",
    } as GraphPaneStateData,
  },
};

export const defaultFrames: FrameState = {
  1: {
    paneType: "video_downlink",
    paneStateData: {
      ready: true,
      channel: 0,
      activeVideoFileID: "",
      muted: true,
      showInfo: false,
    } as VideoPaneStateData,
  },
  2: {
    paneType: "video_downlink",
    paneStateData: {
      ready: true,
      channel: 1,
      activeVideoFileID: "",
      muted: true,
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
    paneType: "photo_all",
    paneStateData: {
      ready: true,
      showFilter: false,
      lockScroll: true,
    } as PhotoAllPaneStateData,
  },
  5: {
    paneType: "iss_location",
    paneStateData: {
      lockMap: true,
      ready: true,
    } as LocationPaneStateData,
  },
  6: {
    paneType: "event_info",
    paneStateData: {
      ready: true,
      showHelp: false,
    } as EventPaneStateData,
  },
  7: {
    paneType: "comm",
    paneStateData: {
      ready: true,
      lockScroll: true,
      filterActive: false,
      sgChannels: [],
      isMuted: false,
      showHelp: true,
    } as CommPaneStateData,
  },
};

/**
 * The state of each frame containing the pane type and the state of the control
 * NOTE: all panes must manage a "ready" boolean in its paneStateData. This is used to determine application-wide readiness
 */
export const initialState: FrameworkState = {
  layout: "n",
  layoutLastChanged: Date.now(),
  frames: defaultFrames,
  source: "ISS",
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
      state.layoutLastChanged = Date.now();
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
      action: { payload: { frameID: number; paneStateProperty: string; paneStateValue: unknown } }
    ) => {
      if (!state.frames[action.payload.frameID]) return;
      (state.frames[action.payload.frameID].paneStateData as Record<string, unknown>)[
        action.payload.paneStateProperty
      ] = action.payload.paneStateValue;
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
  if (source === "ISS") {
    return "EVA Info";
  } else if (source === "NBL") {
    return "NBL Event Info";
  } else if (source === "TEST_EVENTS") {
    return "Test Event Info";
  } else if (source === "ARTEMIS") {
    return "Mission Info";
  } else {
    throw new Error(source);
  }
}
