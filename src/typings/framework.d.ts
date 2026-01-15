/** Definition of all possible layouts */
interface Layouts {
  [key: string]: {
    frameCount: number;
    cssGridRows: number;
  };
}

interface Preset {
  uuid?: string;
  name: string;
  layout: string;
  frames: FrameState;
}

interface Pane {
  title: string;
  shortTitle: string;
  icon?: import("@fortawesome/fontawesome-svg-core").IconProp;
  color: string;
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
  frameID: number;
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
  layout: string;
  layoutLastChanged: number; // milliseconds since epoch
  /** Current mapping of visible frames to Frame types */
  frames: FrameState;
}

interface FrameState {
  [key: string]: PaneState;
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
