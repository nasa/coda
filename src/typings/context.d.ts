// general context provider for combining multiple contexts
type Provider = ({ children }: { children: React.ReactNode }) => React.ReactElement;

// Define the Playhead interface
interface Playhead {
  /** UTC date being viewed */
  date: string;
  appSeconds: number;
  isRunning: boolean;
}

type PlayheadAction =
  | { type: "SET_DATE"; payload: string | null }
  | { type: "SET_APP_SECONDS"; payload: number }
  | { type: "START" }
  | { type: "STOP" }
  | { type: "TICK" };

type PlayheadContextType = {
  playhead: Playhead;
  dispatchPlayhead: React.Dispatch<PlayheadAction>;
};

interface HoverPlayhead {
  hoverSeconds: number | null;
}

interface HoverPlayheadContextType {
  hoverPlayhead: HoverPlayhead;
  setHoverPlayhead: React.Dispatch<React.SetStateAction<HoverPlayhead>>;
}
