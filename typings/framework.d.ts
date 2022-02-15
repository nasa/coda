/** Definition of all possible layouts */
interface Layouts {
  [key: string]: {
    frameCount: number;
    cssGridRows: number;
  };
}

enum Source {
  ISS = "ISS",
  TEST_EVENTS = "TEST_EVENTS",
  NBL = "NBL",
}

interface Pane {
  title: string;
  icon: IconProp;
  color: string;
  defaultPaneStateData:
    | EmptyPaneStateData
    | VideoPaneStateData
    | PhotoPaneStateData
    | PhotoAllPaneStateDate
    | LocationPaneStateData
    | EventPaneStateData;
}

interface Panes {
  [key: string]: Pane;
}

interface FrameworkState {
  /** Currently supports `iss` or `test_events` */
  source: Source;
  /** Letter representing the layout as defined in components/framework/frames.module.css */
  layout: string;
  /** Current mapping of visible frames to Frame types */
  frames: FrameState;
}

interface FrameState {
  [key: string]: PaneState;
}

interface PaneState {
  paneType: string;
  paneStateData: any;
}

type EmptyPaneStateData = {
  ready: boolean;
};

type VideoPaneStateData = {
  downlink: number;
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
  lockPhotosScroll: boolean;
  showHelp: boolean;
};

type LocationPaneStateData = {
  ready: boolean;
  lockMap: boolean;
  showHelp: boolean;
};

type EventPaneStateData = {
  ready: boolean;
  showHelp: boolean;
};
