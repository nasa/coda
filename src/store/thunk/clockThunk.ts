import appCreateAsyncThunk from "./thunkUtil";
import { clearVideos } from "../videos";
import { clearPhotos } from "../photos";
import { clearEphemera } from "../ephemera";
import { clearDayNight } from "../daynight";
import { clearGPSTracks } from "../gps";
import { clearTalkybotAudioFiles } from "../talkybot";
import { clearGraphsManifest, clearGraphsData } from "../graphs";
import { setDate, setAppSeconds, stopClock, startClock } from "../clock";
import { isSameDate } from "utils/date";
import { appSecondsFromDateString } from "utils/formatting";

/**
 * Compute effective appSeconds from clock state, accounting for elapsed time
 * if the clock is currently running.
 */
function getEffectiveAppSeconds(clock: {
  appSecondsAtStartStop: number;
  isRunning: boolean;
  startStopTimestamp: string | null;
}): number {
  let seconds = clock.appSecondsAtStartStop;
  if (clock.isRunning && clock.startStopTimestamp) {
    const elapsed = (Date.now() - Date.parse(clock.startStopTimestamp)) / 1000;
    seconds = Math.floor(seconds + elapsed);
    seconds = Math.min(seconds, 86401);
  }
  return seconds;
}

/**
 * Thunk action to change the viewing date.
 * Clears all date-specific data from stores and sets the new date.
 * The SocketClient will automatically reconnect and fetch new data when playheadDate changes.
 *
 * @param newDate - The new date as an ISO string or YYYY-MM-DD format
 * @param newAppSeconds - Explicit starting time in seconds (defaults to 0 for start of day)
 * @param keepCurrentTime - When true, preserves the current playhead time instead of
 *   using newAppSeconds. If the target date is today and the current time exceeds "now",
 *   snaps to the current wall-clock time.
 */
export const thunkChangeViewingDate = appCreateAsyncThunk<
  { newDate: string; newAppSeconds?: number; keepCurrentTime?: boolean },
  void,
  null
>(
  "thunkChangeViewingDate",
  async ({ newDate, newAppSeconds = 0, keepCurrentTime = false }, { dispatch, getState }) => {
    // Determine the appSeconds to use
    let resolvedAppSeconds = newAppSeconds;
    if (keepCurrentTime) {
      const clock = getState().clock;
      resolvedAppSeconds = getEffectiveAppSeconds(clock);

      // If switching to today and time exceeds wall-clock "now", snap to now
      const now = new Date();
      if (isSameDate(new Date(newDate), now)) {
        const nowSeconds = appSecondsFromDateString(now.toISOString());
        if (resolvedAppSeconds > nowSeconds) {
          resolvedAppSeconds = nowSeconds;
        }
      }
    }

    // Clear all date-specific data stores
    dispatch(clearVideos());
    dispatch(clearPhotos());
    dispatch(clearEphemera());
    dispatch(clearDayNight());
    dispatch(clearGPSTracks());
    dispatch(clearTalkybotAudioFiles());
    dispatch(clearGraphsManifest());
    dispatch(clearGraphsData());

    // Update clock state with new date and reset time tracking
    // This ensures clean state after potentially long-running sessions
    dispatch(setDate(newDate));
    dispatch(setAppSeconds(resolvedAppSeconds));
    // Stop the clock briefly to reset the timestamp, then restart if it was running
    // This prevents elapsed time calculation issues after days of running
    dispatch(thunkResetClockTimestamp());
  }
);

/**
 * Reset the clock timestamp to now without changing isRunning state.
 * Used during date rollover to prevent elapsed time calculation drift.
 */
export const thunkResetClockTimestamp = appCreateAsyncThunk<void, void, null>(
  "thunkResetClockTimestamp",
  async (_, { dispatch, getState }) => {
    const { isRunning } = getState().clock;
    if (isRunning) {
      // Briefly stop and restart to reset the timestamp cleanly
      dispatch(stopClock());
      dispatch(startClock());
    }
  }
);
