import React from "react";
import { PlayheadContextProvider } from "store/contextProviders/playheadContext";
import { HoverPlayheadContextProvider } from "store/contextProviders/hoverPlayheadContext";

import { composeProviders } from "utils/context";

const providers = [HoverPlayheadContextProvider, PlayheadContextProvider];

// Define the props type to include 'children'
const CombinedProviders = ({ children }: { children: React.ReactNode }) => {
  const Combined = composeProviders(providers);
  return <Combined>{children}</Combined>;
};

export default CombinedProviders;
