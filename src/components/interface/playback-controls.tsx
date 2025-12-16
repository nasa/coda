import { FunctionComponent, useState, useEffect, useRef, useCallback } from "react";
import styles from "./playback-controls.module.css";
import { refEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { setAppSeconds, startClock, stopClock } from "store/clock";
import { thunkChangeViewingDate } from "store/thunk/clockThunk";
import ClockInterval from "components/framework/ClockInterval";
import { addMs, midnightZulu } from "utils/date";
import { padZeros } from "utils/formatting";

const SECONDS_IN_DAY = 86400;

/**
 * Returns the next UTC date as a Date object
 */
function getNextDate(currentDate: string): Date {
  const current = new Date(currentDate);
  return addMs(midnightZulu(current), SECONDS_IN_DAY * 1000);
}

/**
 * Updates the browser URL's date parameter without reloading the page
 * @param nextDate - The next date to set in the URL
 */
function updateURLDateParam(nextDate: Date): void {
  const url = new URL(window.location.href);
  const nextDateString = `${nextDate.getUTCFullYear()}-${padZeros(nextDate.getUTCMonth() + 1, 2)}-${padZeros(nextDate.getUTCDate(), 2)}`;

  // Set or update the date parameter
  url.searchParams.set("date", nextDateString);
  // Reset GMT to beginning of day
  url.searchParams.set("gmt", "00:00:00");

  // Update URL without reloading the page
  window.history.replaceState({}, "", url.toString());
}

const PlaybackControls: FunctionComponent = () => {
  const dispatch = useAppDispatch();
  const isRunning = useAppSelector((state) => state.clock.isRunning, refEqual);
  const clockDate = useAppSelector((state) => state.clock.date, refEqual);
  const [appSeconds, setLocalAppSeconds] = useState(0);

  // Track whether we've already triggered rollover to prevent double-triggers
  const hasTriggeredRollover = useRef(false);

  // Reset the rollover flag when we're back to a normal time (not at midnight)
  useEffect(() => {
    if (appSeconds < SECONDS_IN_DAY) {
      hasTriggeredRollover.current = false;
    }
  }, [appSeconds]);

  const performRollover = useCallback(() => {
    if (!clockDate || hasTriggeredRollover.current) return;

    hasTriggeredRollover.current = true;

    const nextDate = getNextDate(clockDate);

    // Check if we would be navigating to a future date (beyond today)
    const today = midnightZulu(new Date());
    const isNextDateFuture = nextDate.getTime() > today.getTime();

    if (isNextDateFuture) {
      // Don't roll over to future dates - stop at end of today
      dispatch(setAppSeconds(SECONDS_IN_DAY - 1));
      return;
    }

    // Update browser URL without reload
    updateURLDateParam(nextDate);

    // Clear stores and change to new date (socket will reconnect automatically)
    dispatch(thunkChangeViewingDate({ newDate: nextDate.toISOString(), newAppSeconds: 0 }));
  }, [clockDate, dispatch]);

  // Check for midnight rollover
  useEffect(() => {
    if (isRunning && appSeconds >= SECONDS_IN_DAY && !hasTriggeredRollover.current) {
      performRollover();
    }
  }, [appSeconds, isRunning, performRollover]);

  const handlePlayPause = () => {
    dispatch(isRunning ? stopClock() : startClock());
  };

  const jumpTime = (seconds: number) => {
    dispatch(setAppSeconds(appSeconds + seconds));
  };

  let playPauseSvgName;
  if (isRunning) {
    playPauseSvgName = styles.pauseSVG;
  } else {
    playPauseSvgName = styles.playSVG;
  }
  return (
    <div className={styles.container}>
      <ClockInterval setAppSeconds={setLocalAppSeconds} />
      <div className={styles.controlButton}>
        <div
          className={`${styles.playPauseImg} ${playPauseSvgName}`}
          onClick={handlePlayPause}
        ></div>
      </div>
      <div
        className={styles.controlButton}
        onClick={() => {
          jumpTime(-5);
        }}
      >
        <div className={styles.jumpLeftImg}></div>
        <div className={styles.jumpLeftText}>5</div>
      </div>
      <div
        className={styles.controlButton}
        onClick={() => {
          jumpTime(5);
        }}
      >
        <div className={styles.jumpRightImg}></div>
        <div className={styles.jumpRightText}>5</div>
      </div>
    </div>
  );
};

export default PlaybackControls;
