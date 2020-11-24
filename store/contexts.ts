import { createContext } from "react";

// setup the global state and dispatch for changing the state
// see https://reactjs.org/docs/hooks-faq.html#how-to-avoid-passing-callbacks-down
export const TimeSyncDispatch = createContext(null);
export const TimeSyncState = createContext(null);
