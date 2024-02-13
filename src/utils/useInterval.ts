/*
Borrowed from https://overreacted.io/making-setinterval-declarative-with-react-hooks/#just-show-me-the-code
*/

import { useEffect, useRef } from "react";

/**
 * Create an interval hook
 */
export default function useInterval(callback: () => void, delay: number) {
  if (typeof window === "undefined") {
    return;
  }

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
    if (delay !== null) {
      let id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}
