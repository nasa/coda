// eslint-disable-next-line no-restricted-imports
import { useDispatch } from "react-redux";
import type { AppDispatch } from "store";

// Export a hook that can be reused to resolve types
// ref: https://redux-toolkit.js.org/usage/usage-with-typescript
export const useAppDispatch: () => AppDispatch = useDispatch;
