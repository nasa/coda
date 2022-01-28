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
  defaultPaneStateData: any;
}

interface Panes {
  [key: string]: Pane;
}

interface FrameworkState {
  /** Currently supports `iss` or `test_events` */
  selectedSource: Source;
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

type VideoPaneControlStateData = {
  downlink: number;
  activeVideoFileID: string;
  ready: boolean;
  muted: boolean;
  showInfo: boolean;
};

type PhotoPaneControlStateData = {
  ready: boolean;
  showInfo: boolean;
  showFilter: boolean;
};

type LocationPaneControlStateData = {
  lockToggle: boolean;
  ready: boolean;
};
