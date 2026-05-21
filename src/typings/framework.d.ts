interface Preset {
  uuid?: string;
  name: string;
  layout: string;
  paneInstances: { [paneInstanceId: string]: PaneState };
  /** Version of the preset format: 2 = layout-letter based, 3 = serialized Dockview JSON */
  version?: 2 | 3;
  /** Fully-specified Dockview layout JSON (v3 presets only) */
  dockviewLayout?: import("dockview-react").SerializedDockview;
}

interface Pane {
  title: string;
  shortTitle: string;
  icon?: import("@fortawesome/fontawesome-svg-core").IconProp;
  defaultPaneStateData:
    | EmptyPaneStateData
    | VideoPaneStateData
    | PhotoPaneStateData
    | PhotoAllPaneStateData
    | LocationPaneStateData
    | EventPaneStateData
    | CommPaneStateData
    | PcdAudioPaneStateData;
}

type PaneType =
  | "empty"
  | "video_downlink"
  | "video_non_downlink"
  | "photo"
  | "photo_all"
  | "iss_location"
  | "gps_location"
  | "event_info"
  | "comm"
  | "graph"
  | "pcd_audio";

type Panes = Record<PaneType, Pane>;

interface PaneComponentProps {
  paneInstanceId: number;
  groupDimensions: number[];
}

type PaneTypeComponentSet = {
  controls: React.ComponentType<PaneComponentProps> | null;
  pane: React.ComponentType<PaneComponentProps> | null;
};

type PaneTypeComponentSets = Record<PaneType, PaneTypeComponentSet>;

interface FrameworkState {
  /** Currently supports `iss` or `test_events` */
  source: Source;
  /** Letter representing the layout as defined in components/framework/frames.module.css */
  layout: LayoutLetter;
  layoutLastChanged: number; // milliseconds since epoch
  /** Current pane instances */
  paneInstances: { [paneInstanceId: string]: PaneState };
}

type AllPaneStateData =
  | EmptyPaneStateData
  | VideoPaneStateData
  | PhotoPaneStateData
  | PhotoAllPaneStateData
  | LocationPaneStateData
  | GpsTrackPaneStateData
  | EventPaneStateData
  | CommPaneStateData
  | GraphPaneStateData
  | PcdAudioPaneStateData;

interface PaneState {
  paneType: PaneType;
  paneStateData: AllPaneStateData;
}

type EmptyPaneStateData = {
  ready: boolean;
};

type VideoPaneStateData = {
  channel: number;
  activeVideoFileID: string;
  ready: boolean;
  muted: boolean;
  showInfo: boolean;
  showHelp: boolean;
};

type PhotoPaneStateData = {
  ready: boolean;
  showInfo: boolean;
  showFilter: boolean;
  showHelp: boolean;
};

type PhotoAllPaneStateData = {
  ready: boolean;
  showFilter: boolean;
  lockScroll: boolean;
  showHelp: boolean;
};

type LocationPaneStateData = {
  ready: boolean;
  lockMap: boolean;
  showHelp: boolean;
};

type GpsTrackPaneStateData = {
  ready: boolean;
  lockMap: boolean;
  showHelp: boolean;
  gpsTrackToggles: GPSTrackToggles;
};

type EventPaneStateData = {
  ready: boolean;
  showHelp: boolean;
};

type CommPaneStateData = {
  ready: boolean;
  lockScroll: boolean;
  filterActive: boolean;
  sgChannels: string[];
  unselectedSgChannels: string[];
  isMuted: boolean;
  showHelp: boolean;
};

type GraphPaneStateData = {
  ready: boolean;
  lockScroll: boolean;
  showHelp: boolean;
  selectedGraphId: string;
  durationSelection?: number; // seconds
};

type PcdAudioPaneStateData = {
  ready: boolean;
  /** Device channel keys whose audio is currently unmuted (e.g. ["PLT", "MS2"]) */
  unmutedChannels: string[];
  showHelp: boolean;
};
