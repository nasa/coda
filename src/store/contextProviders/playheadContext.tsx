import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";

// Create the context
const PlayheadCtx = createContext<PlayheadContextType | undefined>(undefined);

// Provider component
export const PlayheadContextProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const [playhead, setPlayhead] = useState<Playhead>({
    date: null,
    appSeconds: 28800, // 08:00:00Z
    isRunning: false,
  });

  const playheadIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // setup the interval to update the clock if the playhead is running
  useEffect(() => {
    if (playhead.isRunning) {
      playheadIntervalRef.current = setInterval(() => {
        setPlayhead((prev) => ({
          ...prev,
          appSeconds: prev.appSeconds + 1,
        }));
      }, 1000);
    } else {
      clearInterval(playheadIntervalRef.current);
    }
    return () => clearInterval(playheadIntervalRef.current);
  }, [playhead.isRunning, playheadIntervalRef]);

  return <PlayheadCtx.Provider value={{ playhead, setPlayhead }}>{children}</PlayheadCtx.Provider>;
};

// Custom hook for consuming the context
export const usePlayheadContext = (): PlayheadContextType => {
  const context = useContext(PlayheadCtx);
  if (!context) {
    throw new Error("usePlayheadContext must be used within a PlayheadContextProvider");
  }
  return context;
};
