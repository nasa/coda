import appCreateAsyncThunk from "./thunkUtil";
import { clearVideos } from "../videos";
import { clearPhotos } from "../photos";
import { clearEphemera } from "../ephemera";
import { clearDayNight } from "../daynight";
import { clearGPSTracks } from "../gps";
import { clearTalkybotAudioFiles } from "../talkybot";
import { clearGraphsManifest, clearGraphsData } from "../graphs";
import { setDate, setAppSeconds, stopClock, startClock } from "../clock";

/**
 * Thunk action to change the viewing date.
 * Clears all date-specific data from stores and sets the new date.
 * The SocketClient will automatically reconnect and fetch new data when playheadDate changes.
 *
 * @param newDate - The new date as an ISO string or YYYY-MM-DD format
 * @param newAppSeconds - Optional starting time in seconds (defaults to 0 for start of day)
 */
export const thunkChangeViewingDate = appCreateAsyncThunk<
  { newDate: string; newAppSeconds?: number },
  void,
  null
>("thunkChangeViewingDate", async ({ newDate, newAppSeconds = 0 }, { dispatch }) => {
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
  dispatch(setAppSeconds(newAppSeconds));
  // Stop the clock briefly to reset the timestamp, then restart if it was running
  // This prevents elapsed time calculation issues after days of running
  dispatch(thunkResetClockTimestamp());
});

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
