// general context provider for combining multiple contexts
type Provider = ({ children }: { children: ReactNode }) => React.ReactElement;

// Define the Playhead interface
interface Playhead {
  /** UTC date being viewed */
  date: string;
  appSeconds: number;
  isRunning: boolean;
}

// Define the context value type
interface PlayheadContextType {
  playhead: Playhead;
  setPlayhead: React.Dispatch<React.SetStateAction<Playhead>>;
}

interface HoverPlayhead {
  hoverSeconds: number | null;
}

interface HoverPlayheadContextType {
  hoverPlayhead: HoverPlayhead;
  setHoverPlayhead: React.Dispatch<React.SetStateAction<HoverPlayhead>>;
}
