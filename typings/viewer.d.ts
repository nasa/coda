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
  state?: any;
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
  controlStateData: any;
}
