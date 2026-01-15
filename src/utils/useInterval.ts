/*
Borrowed from https://overreacted.io/making-setinterval-declarative-with-react-hooks/#just-show-me-the-code
*/

import { useEffect, useRef } from "react";

/**
 * Create an interval hook
 */
export default function useInterval(callback: () => void, delay_ms: number): void {
  const savedCallback = useRef(() => {});

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    function tick() {
      savedCallback.current();
    }
    if (delay_ms !== null) {
      const id = setInterval(tick, delay_ms);
      return () => clearInterval(id);
    }
    return undefined;
  }, [delay_ms]);
}
