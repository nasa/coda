import { createContext, JSX, ReactNode, useContext, useState } from "react";

// Create the context
const HoverPlayheadCtx = createContext<HoverPlayheadContextType | undefined>(undefined);

// Provider component
export const HoverPlayheadContextProvider = ({
  children,
}: {
  children: ReactNode;
}): JSX.Element => {
  const [hoverPlayhead, setHoverPlayhead] = useState<HoverPlayhead>({
    hoverSeconds: null,
  });

  return (
    <HoverPlayheadCtx.Provider value={{ hoverPlayhead, setHoverPlayhead }}>
      {children}
    </HoverPlayheadCtx.Provider>
  );
};

// Custom hook for consuming the context
export const useHoverPlayheadContext = (): HoverPlayheadContextType => {
  const context = useContext(HoverPlayheadCtx);
  if (!context) {
    throw new Error("usePlayheadContext must be used within a PlayheadContextProvider");
  }
  return context;
};
