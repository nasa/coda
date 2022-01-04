/** Definition of all possible layouts */
interface Layouts {
  [key: number]: {
    svg: string;
    frameCount: number;
  };
}

enum FrameSource {
  ISS = "iss",
  TEST_EVENTS = "test_events",
  NBL = "nbl",
}

interface Frame {
  source: FrameSource;
  title: string;
  icon: IconProp;
  color: string;
  defaultPaneStateData: any;
}

interface Frames {
  [key: string]: Frame;
}

interface ViewerState {
  /** Currently supports `iss` or `test_events` */
  selectedSource: FrameSource;
  /** Number representing the layout ID */
  layout: number;
  /** Current mapping of visible frames to Frame types */
  frames: {
    [key: string]: FrameState;
  };
}

interface FrameState {
  paneType: string;
  paneStateData: any;
}

type VideoDLPaneControlStateData = {
  downlink: number;
  activeVideoFileID: string;
  ready: boolean;
  muted: boolean;
  showInfo: boolean;
  //nonDownlinkIDs: string[];
};

type PhotoPaneControlStateData = {
  ready: boolean;
  infoToggle: boolean;
  infoHover: boolean;
  filterToggle: boolean;
};

type LocationPaneControlStateData = {
  lockToggle: boolean;
  ready: boolean;
};
