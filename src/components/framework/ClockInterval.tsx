import { FunctionComponent, useEffect, useRef } from "react";
import { refEqual, useAppSelector } from "utils/useAppSelector";

/**
 * This component is responsible for updating the parent's appSeconds based on the clock's state.
 * Include this component in any React component that needs real-time clock updates.
 *
 * @param setAppSeconds - Callback function to update the local appSeconds state
 *
 * @example
 * ```tsx
 * const [appSeconds, setAppSeconds] = useState(0);
 * return (
 *   <>
 *     <ClockInterval setAppSeconds={setAppSeconds} />
 *     <div>Current time: {appSeconds}</div>
 *   </>
 * );
 * ```
 */
const ClockInterval: FunctionComponent<{
  setAppSeconds: (seconds: number) => void;
}> = ({ setAppSeconds }) => {
  const appSecondsAtStartStop = useAppSelector(
    (state) => state.clock.appSecondsAtStartStop,
    refEqual
  );
  const isRunning = useAppSelector((state) => state.clock.isRunning, refEqual);
  const startStopTimestamp = useAppSelector((state) => state.clock.startStopTimestamp, refEqual);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning) {
      if (!intervalRef.current) {
        intervalRef.current = setInterval(() => {
          const secondsSinceStarted = (Date.now() - Date.parse(startStopTimestamp)) / 1000;
          const newAppSeconds = Math.floor(appSecondsAtStartStop + secondsSinceStarted);
          // Cap at 86401 to prevent race conditions while allowing day rollover at 86400
          setAppSeconds(Math.min(newAppSeconds, 86401));
        }, 100);
      }
    } else {
      // When stopped, calculate final position
      if (startStopTimestamp) {
        const secondsSinceStarted = (Date.now() - Date.parse(startStopTimestamp)) / 1000;
        const newAppSeconds = Math.floor(appSecondsAtStartStop + secondsSinceStarted);
        // Cap at 86401 to prevent race conditions while allowing day rollover at 86400
        setAppSeconds(Math.min(newAppSeconds, 86401));
      } else {
        // No timestamp yet, just use the stored value
        setAppSeconds(appSecondsAtStartStop);
      }

      clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }

    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [appSecondsAtStartStop, isRunning, startStopTimestamp, setAppSeconds]);

  return <></>;
};

export default ClockInterval;
