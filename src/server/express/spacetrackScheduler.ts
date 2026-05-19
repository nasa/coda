/**
 * Space-Track TLE Update Scheduler
 *
 * This module manages the scheduled fetching of TLE data from Space-Track.org.
 * It provides status tracking and exposes functions for the admin monitoring page.
 *
 * ## Timing overview
 *
 * 1. **On server start** (`startSpacetrackScheduler`): we check if the DB
 *    already has a recent record (< 6 hours old). If so, we skip the initial
 *    fetch to avoid hammering Space-Track on frequent dev restarts.
 * 2. **First scheduled fire**: we wait until the next "safe" clock minute
 *    (:12 or :48 past the hour) so we avoid Space-Track's known busy windows
 *    around :00 and :30. This is `msUntilNextSafeMinute`.
 * 3. **Recurring fires**: every 6 hours after the first fire, on the same
 *    safe-minute mark.
 * 4. **Manual triggers** (`triggerSpacetrackUpdate`): fire immediately and
 *    independently. The regular interval schedule continues unchanged; manual
 *    triggers do not shift or reset the regular timer.
 *
 * ## Ephemeris sync on Prod vs non-prod
 *
 * If `EPHEMERIS_SYNC_FROM_URL` is set, the scheduler calls
 * the remote sync function instead of Space-Track directly. The same timing logic
 * applies; the only difference is the data source. All non-production CODA instances
 * should be remote syncing from prod.
 *
 * IMPORTANT: Space-Track has strict rate limiting. The scheduler runs every 6 hours
 * and fetches 24 hours of TLE data in a single API call. Do not increase the frequency.
 */
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { updateFromSpaceTrack } from "server/processing/ephemeris/ephemeris-spacetrack";
import { syncEphemerisFromRemote } from "server/processing/ephemeris/ephemeris-remoteSync";
import getEphemera, { getLatestRecordCreatedAt } from "server/processing/ephemeris/ephemeris";
import { ConsoleLogger } from "../../utils/logging/consoleLogger";
import { globalValues } from "./global";
import { emitSpacetrackInspectorUpdate, emitDataUpdate } from "./sockets";

dayjs.extend(duration);

// Run every 6 hours per Space-Track's API guidelines.
// Must be ≥ 60 minutes to work with the safe-minute scheduling logic.
const SPACETRACK_UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Skip initial fetch if latest record was created less than this threshold */
export const SKIP_FETCH_THRESHOLD_MS = 6 * 60 * 60 * 1000;
/**
 * Space-Track asks API users to avoid the busy minutes around the top and
 * bottom of the hour (e.g., :00 and :30). Scheduling the first fire at :12 or
 * :48 keeps every subsequent 6h fire on the same safe minute mark (since
 * 360 min is a clean multiple of 60 min — see interval constraint in the
 * module header comment).
 */
const SAFE_MINUTES = [12, 48] as const;

/**
 * Returns ms from now until the next clock minute matching SAFE_MINUTES that is
 * also at least `minDelayMs` ahead.
 */
const msUntilNextSafeMinute = (minDelayMs: number = 0): number => {
  const now = Date.now();
  const earliest = new Date(now + minDelayMs);
  const minute = earliest.getMinutes();
  const target = SAFE_MINUTES.find((m) => m > minute) ?? SAFE_MINUTES[0] + 60;
  const targetDate = new Date(earliest);
  targetDate.setMinutes(target, 0, 0);
  return targetDate.getTime() - now;
};

const updateState = (updates: Partial<SpaceTrackTrackerData>): void => {
  globalValues.spacetrackTrackerData = { ...globalValues.spacetrackTrackerData, ...updates };
};

const isWithinThreshold = (timestamp: string | Date): boolean => {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  return Date.now() - date.getTime() < SKIP_FETCH_THRESHOLD_MS;
};

const checkLastAttemptAge = (): SpaceTrackFetchDecision | null => {
  if (!globalValues.spacetrackTrackerData.lastOperationStartedAt) return null;

  if (isWithinThreshold(globalValues.spacetrackTrackerData.lastOperationStartedAt)) {
    const ageMs =
      Date.now() - new Date(globalValues.spacetrackTrackerData.lastOperationStartedAt).getTime();
    return {
      shouldFetch: false,
      skipReason: `last fetch attempt was ${dayjs.duration(ageMs).asMinutes().toFixed(0)} minutes ago`,
    };
  }
  return null;
};

const checkLatestRecordAge = async (): Promise<SpaceTrackFetchDecision | null> => {
  try {
    const latestCreatedAt = await getLatestRecordCreatedAt();
    if (latestCreatedAt && isWithinThreshold(latestCreatedAt)) {
      const ageMs = Date.now() - latestCreatedAt.getTime();
      return {
        shouldFetch: false,
        skipReason: `latest record is ${dayjs.duration(ageMs).asMinutes().toFixed(0)} minutes old`,
      };
    }
  } catch (error) {
    ConsoleLogger.warn("Could not check latest record age, will fetch from Space-Track:", error);
  }
  return null;
};

/**
 * Determine if we should fetch from Space-Track on startup.
 *
 * This is primarily a precaution for local development environments where the server
 * may restart frequently (e.g., during active development). Without this check, we could
 * hammer Space-Track's servers with excessive requests and risk getting our IP banned.
 *
 * Checks in order:
 * 1. Last fetch attempt time (prevents hammering on dev restarts)
 * 2. Latest database record age (fallback check)
 */
const determineShouldFetch = async (): Promise<SpaceTrackFetchDecision> => {
  const lastAttemptCheck = checkLastAttemptAge();
  if (lastAttemptCheck) return lastAttemptCheck;

  const recordAgeCheck = await checkLatestRecordAge();
  if (recordAgeCheck) return recordAgeCheck;

  return { shouldFetch: true, skipReason: "" };
};

/**
 * Emit updated ephemeris data to all ISS clients viewing today's date.
 * Called after a successful Space-Track TLE update to push fresh data.
 * Socket.IO delivers only to clients in the relevant room; no need to check
 * membership here.
 */
const emitEphemerisToTodayClients = async (): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const source: Source = "ISS";

  let ephemerisData: FetchResponse<EphemerisEntry[]> | null = null;
  try {
    ephemerisData = await getEphemera({ dateWanted: today });
  } catch (error) {
    ConsoleLogger.warn("Failed to fetch ephemeris data for emit:", error);
    return;
  }

  if (!ephemerisData) {
    return;
  }

  emitDataUpdate({
    source,
    dataDate: today,
    dataUpdate: { type: "ephemeris", response: ephemerisData },
  });
};

// Update execution
// Can be from remote or directly from Space-Track
const performEphemerisUpdate = async (isManual: boolean = false): Promise<void> => {
  const startTime = Date.now();
  const attemptedAt = new Date(startTime).toISOString();

  updateState({
    lastOperationStartedAt: attemptedAt,
    totalOperations: globalValues.spacetrackTrackerData.totalOperations + 1,
  });

  emitSpacetrackInspectorUpdate();

  // Execute the update — dispatches to Space-Track or remote.
  const result = process.env.EPHEMERIS_SYNC_FROM_URL
    ? await syncEphemerisFromRemote()
    : await updateFromSpaceTrack();

  const endTime = Date.now();
  const completedAt = new Date(endTime).toISOString();
  const durationMs = endTime - startTime;

  updateState({
    lastOperationCompletedAt: completedAt,
    lastOperationDurationMs: durationMs,
  });

  // Handle result
  if (result.success) {
    updateState({
      lastOperationSuccess: true,
      lastSuccessAt: completedAt,
      lastFetchedEpoch: result.epoch ?? null,
      lastRecordsInserted: result.recordsInserted ?? null,
      lastRecordsSkipped: result.recordsSkipped ?? null,
      successfulOperations: globalValues.spacetrackTrackerData.successfulOperations + 1,
    });
  } else {
    updateState({
      lastOperationSuccess: false,
      lastErrorMessage: result.errorMessage ?? "Unknown error",
      lastErrorAt: completedAt,
      failedOperations: globalValues.spacetrackTrackerData.failedOperations + 1,
    });
  }

  // Log result
  const prefix = isManual ? "(manual) " : "";
  if (result.success) {
    ConsoleLogger.debug(
      `Space-Track TLE update${prefix} completed successfully in ${durationMs}ms, epoch: ${result.epoch}, inserted: ${result.recordsInserted}, skipped: ${result.recordsSkipped}`
    );
    // Emit updated ephemeris data to all clients viewing today
    await emitEphemerisToTodayClients();
  } else {
    ConsoleLogger.error(`Space-Track TLE update${prefix} failed: ${result.errorMessage}`);
  }

  // Finalize state and notify clients

  // Compute the post-fire `nextOperationAt` timestamp shown in the inspector.
  // Only update for scheduled fires; manual triggers keep the existing schedule.
  if (!isManual && globalValues.spacetrackTrackerData.isActive) {
    const nextOperationAt = new Date(Date.now() + SPACETRACK_UPDATE_INTERVAL_MS).toISOString();
    updateState({ nextOperationAt });
  }

  emitSpacetrackInspectorUpdate();
};

// Scheduler control

export const startSpacetrackScheduler = async (): Promise<void> => {
  if (globalValues.spacetrackInterval) {
    ConsoleLogger.warn("Space-Track scheduler already running, stopping first");
    stopSpacetrackScheduler();
  }

  updateState({
    isActive: true,
    startedAt: new Date().toISOString(),
  });

  // Determine if initial fetch is needed
  const { shouldFetch, skipReason } = await determineShouldFetch();

  if (shouldFetch) {
    ConsoleLogger.debug("Starting initial Space-Track TLE update");
    void performEphemerisUpdate(false);
  } else {
    ConsoleLogger.notice(
      `Skipping initial Space-Track fetch - ${skipReason} (threshold: ${dayjs.duration(SKIP_FETCH_THRESHOLD_MS).asMinutes().toFixed(0)} minutes)`
    );
  }

  scheduleRecurring();
  emitSpacetrackInspectorUpdate();
};

/**
 * Schedule (or reschedule) the recurring 6h timer so the first fire lands on
 * a safe clock minute (:12 or :48). Subsequent fires repeat every 6h from
 * that point. Replaces any existing scheduled timer.
 */
const scheduleRecurring = (): void => {
  if (globalValues.spacetrackInterval) {
    clearInterval(globalValues.spacetrackInterval);
    globalValues.spacetrackInterval = null;
  }
  const delayMs = msUntilNextSafeMinute();
  const firstFireAt = new Date(Date.now() + delayMs);
  updateState({ nextOperationAt: firstFireAt.toISOString() });
  globalValues.spacetrackInterval = setTimeout(() => {
    ConsoleLogger.debug("Running scheduled Space-Track TLE update");
    void performEphemerisUpdate(false);
    globalValues.spacetrackInterval = setInterval(() => {
      ConsoleLogger.debug("Running scheduled Space-Track TLE update");
      void performEphemerisUpdate(false);
    }, SPACETRACK_UPDATE_INTERVAL_MS);
  }, delayMs);
  ConsoleLogger.info(
    `Space-Track scheduler set — next fire at ${firstFireAt.toISOString()} (:12/:48), then every ${dayjs.duration(SPACETRACK_UPDATE_INTERVAL_MS).asHours().toFixed(0)}h`
  );
};

export const stopSpacetrackScheduler = (): void => {
  if (globalValues.spacetrackInterval) {
    clearInterval(globalValues.spacetrackInterval);
    globalValues.spacetrackInterval = null;
  }
  updateState({
    isActive: false,
    nextOperationAt: null,
  });
  ConsoleLogger.info("Space-Track scheduler stopped");
  emitSpacetrackInspectorUpdate();
};

export const triggerManualEphemerisUpdate = async (username: string): Promise<void> => {
  ConsoleLogger.notice(`Manual Space-Track update triggered by ${username}`);

  updateState({
    lastManualTriggerAt: new Date().toISOString(),
    lastManualTriggerBy: username,
  });

  // Run the fetch immediately. The regular interval schedule is not touched.
  await performEphemerisUpdate(true);
};
