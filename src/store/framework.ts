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

export const allPanes: Panes = {
  empty: {
    title: "Select display type",
    shortTitle: "None",
    icon: undefined,
    defaultPaneStateData: {
      ready: true,
    },
  },
  video_downlink: {
    title: "Video Downlink",
    shortTitle: "Video",
    icon: faVideo,
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
    title: "Video Non-Downlink",
    shortTitle: "Video",
    icon: faVideo,
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
    defaultPaneStateData: {
      ready: true,
      showHelp: false,
    } as EventPaneStateData,
  },
  comm: {
    title: "Communications",
    shortTitle: "Comms",
    icon: faSatellite,
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
    defaultPaneStateData: {
      ready: true,
      lockScroll: true,
      showHelp: false,
      selectedGraphId: "",
    } as GraphPaneStateData,
  },
};

export const defaultPaneInstances: { [key: string]: PaneState } = {
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
  paneInstances: defaultPaneInstances,
  source: "ISS",
  dockviewSnapshot: null,
};

export const frameworkSlice = createSlice({
  name: "framework",
  initialState,
  reducers: {
    /**
     * Change the panel layout preset.
     * Trims frames to only contain entries for panels 1–frameCount so that
     * dynamically added panels (via "+") always start empty.
     */
    changeLayout: (state, action: { payload: { layout: string; frameCount: number } }) => {
      state.layout = action.payload.layout;
      state.layoutLastChanged = Date.now();
      // Clear any v3 snapshot so the new layout letter takes effect
      state.dockviewSnapshot = null;
      // Remove frame entries beyond the preset's panel count
      for (const key of Object.keys(state.paneInstances)) {
        if (Number(key) > action.payload.frameCount) {
          delete state.paneInstances[key];
        }
      }
    },

    /**
     * Select the type of frame to render in a frame
     */
    setPaneType: (state, action: { payload: { paneInstanceId: number; paneType: PaneType } }) => {
      state.paneInstances[action.payload.paneInstanceId] = {
        paneType: action.payload.paneType,
        /* Set the pane state to the default state for this paneType */
        paneStateData: allPanes[action.payload.paneType].defaultPaneStateData,
      };
    },

    /**
     * Set the state of all frames. Used when state is sent in on a query parameter.
     * The provided frames are used as-is — callers must pre-trim to match the layout.
     */
    setAllFrameworkState: (state, action: { payload: FrameworkState }) => {
      state.source = action.payload.source;
      allPanes["event_info"].title = getEventInfoTitleBySource(action.payload.source);
      state.layout = action.payload.layout;
      state.layoutLastChanged = Date.now();
      state.paneInstances = action.payload.paneInstances;
      state.dockviewSnapshot = action.payload.dockviewSnapshot ?? null;
    },

    /**
     * Set a state value for use within a pane. The list of available state values depends on the pane type
     */
    setPaneStateDataValue: (
      state,
      action: {
        payload: { paneInstanceId: number; paneStateProperty: string; paneStateValue: unknown };
      }
    ) => {
      if (!state.paneInstances[action.payload.paneInstanceId]) return;
      (state.paneInstances[action.payload.paneInstanceId].paneStateData as Record<string, unknown>)[
        action.payload.paneStateProperty
      ] = action.payload.paneStateValue;
    },
    /**
     * Add a new frame with the "empty" pane type (used when adding panels via the + button)
     */
    addFrame: (state, action: { payload: number }) => {
      if (!state.paneInstances[action.payload]) {
        state.paneInstances[action.payload] = {
          paneType: "empty",
          paneStateData: allPanes["empty"].defaultPaneStateData,
        };
      }
    },

    /**
     * Remove a frame from state (used when closing panels via the X button)
     */
    removeFrame: (state, action: { payload: number }) => {
      delete state.paneInstances[action.payload];
    },
  },
});

export const {
  changeLayout,
  setPaneType,
  setAllFrameworkState,
  setPaneStateDataValue,
  addFrame,
  removeFrame,
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
