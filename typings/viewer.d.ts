/** Definition of all possible layouts */
interface Layouts {
  [key: number]: {
    svg: string;
    frameCount: number;
  };
}

interface Frame {
  source: string;
  title: string;
  icon: IconProp;
  color: string;
  state?: any;
}

interface Frames {
  [key: number]: Frame;
}

interface ViewerState {
  /** Currently supports `iss` or `test-events` */
  selectedSource: string;
  /** Number representing the layout ID */
  layout: number;
  /** Current mapping of visible frames to Frame types */
  frames: {
    [key: number]: number;
  };
}
