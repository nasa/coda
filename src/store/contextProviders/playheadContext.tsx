import { createContext, ReactNode, useContext, useEffect, useReducer, useRef } from "react";
import { isSameDate } from "utils/date";
import { appSecondsFromDateString } from "utils/formatting";

// Create the context
const PlayheadCtx = createContext<PlayheadContextType | undefined>(undefined);

export function playheadReducer(state: Playhead, action: PlayheadAction): Playhead {
  switch (action.type) {
    case "SET_DATE":
      return { ...state, date: action.payload };

    case "SET_APP_SECONDS": {
      let newAppSeconds = action.payload;

      // If it's "today," disallow future time
      if (state.date && isSameDate(new Date(), new Date(state.date))) {
        const currentTimeAppSeconds = appSecondsFromDateString(new Date().toISOString());
        if (newAppSeconds > currentTimeAppSeconds) {
          newAppSeconds = currentTimeAppSeconds;
        }
      }

      return {
        ...state,
        appSeconds: newAppSeconds,
      };
    }

    case "START":
      return { ...state, isRunning: true };

    case "STOP":
      return { ...state, isRunning: false };

    case "TICK":
      return { ...state, appSeconds: state.appSeconds + 1 };

    default:
      return state;
  }
}

// Provider component
export const PlayheadContextProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  // Initialize the reducer
  const initialState: Playhead = {
    date: null,
    appSeconds: 28800, // 08:00:00Z
    isRunning: false,
  };

  const [playhead, dispatchPlayhead] = useReducer(playheadReducer, initialState);

  const playheadIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // setup the interval to update the clock if the playhead is running
  useEffect(() => {
    if (playhead.isRunning) {
      playheadIntervalRef.current = setInterval(() => {
        dispatchPlayhead({ type: "TICK" });
      }, 1000);
    } else {
      clearInterval(playheadIntervalRef.current);
    }
    return () => clearInterval(playheadIntervalRef.current);
  }, [playhead.isRunning]);

  return (
    <PlayheadCtx.Provider value={{ playhead, dispatchPlayhead }}>{children}</PlayheadCtx.Provider>
  );
};

// Custom hook for consuming the context
export const usePlayheadContext = (): PlayheadContextType => {
  const context = useContext(PlayheadCtx);
  if (!context) {
    throw new Error("usePlayheadContext must be used within a PlayheadContextProvider");
  }
  return context;
};
