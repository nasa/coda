interface Preset {
  uuid?: string;
  name: string;
  layout: string;
  paneInstances: { [key: string]: PaneState };
  /** Version of the preset format: 2 = layout-letter based, 3 = serialized Dockview JSON */
  version?: 2 | 3;
  /** Serialized Dockview layout JSON (v3 presets only) */
  dockviewSnapshot?: import("dockview-react").SerializedDockview;
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
    | CommPaneStateData;
}

interface Panes {
  [key: string]: Pane;
}

interface PaneComponentProps {
  paneInstanceId: number;
  frameDimensions: number[];
}

type PaneTypeComponentSet = {
  controls: React.ComponentType<PaneComponentProps> | null;
  pane: React.ComponentType<PaneComponentProps> | null;
};

type PaneTypeComponentSets = {
  [key: string]: PaneTypeComponentSet;
};

interface FrameworkState {
  /** Currently supports `iss` or `test_events` */
  source: Source;
  /** Letter representing the layout as defined in components/framework/frames.module.css */
  layout: LayoutLetter;
  layoutLastChanged: number; // milliseconds since epoch
  /** Current pane instances */
  paneInstances: { [key: string]: PaneState };
  /** Serialized Dockview layout JSON — snapshot for initialization only, not kept in sync */
  dockviewSnapshot?: import("dockview-react").SerializedDockview | null;
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
  | GraphPaneStateData;

interface PaneState {
  paneType: string;
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
