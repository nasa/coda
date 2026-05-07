/**
 * Space-Track TLE Update Scheduler
 *
 * This module manages the scheduled fetching of TLE data from Space-Track.org.
 * It provides status tracking and exposes functions for the admin monitoring page.
 *
 * IMPORTANT: Space-Track has strict rate limiting. The scheduler runs every 6 hours
 * and fetches 30 days of TLE data in a single API call. Do not increase the frequency.
 */
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { updateFromSpaceTrack } from "server/processing/ephemeris-spacetrack";
import { syncEphemerisFromProd } from "server/processing/ephemeris-prod-sync";
import getEphemera, { getLatestRecordCreatedAt } from "server/processing/ephemeris";
import { ConsoleLogger } from "../../utils/logging/consoleLogger";
import { globalValues, getSocketIO } from "./global";
import { emitSpacetrackInspectorUpdate, emitDataUpdate } from "./sockets";

dayjs.extend(duration);

// Run every 6 hours per Space-Track's API guidelines.
const SPACETRACK_UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Skip initial fetch if latest record was created less than this threshold */
export const SKIP_FETCH_THRESHOLD_MS = 6 * 60 * 60 * 1000;
/**
 * Space-Track asks API users to avoid the busy minutes around the top and
 * bottom of the hour (e.g., :00 and :30). Aligning the recurring scheduler to
 * fire at :12 or :48 of some hour keeps every subsequent 6h fire on the same
 * safe minute mark (since 360 min is a clean multiple of 60 min).
 */
const SAFE_MINUTES = [12, 48] as const;

/**
 * Returns ms from now until the next clock minute matching SAFE_MINUTES that is
 * also at least `minDelayMs` ahead. The min-delay floor prevents a manual
 * trigger at, say, :05 from causing a recurring fire at :12 just minutes later
 * (which would be two Space-Track hits inside a 6h window).
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

/** Whichever update path applies to this instance — see EPHEMERIS_SYNC_FROM_URL. */
const runUpdate = (): Promise<SpaceTrackUpdateResult> =>
  process.env.EPHEMERIS_SYNC_FROM_URL ? syncEphemerisFromProd() : updateFromSpaceTrack();

const updateState = (updates: Partial<SpaceTrackTrackerData>): void => {
  globalValues.spacetrackTrackerData = { ...globalValues.spacetrackTrackerData, ...updates };
};

/**
 * Compute the post-fire `nextOperationAt`: every fire (aligned or recurring)
 * is followed 6h later by another fire on the same safe minute, since 360 min
 * is a clean multiple of 60 min. Called from performSpaceTrackUpdate after the
 * fetch completes; for the pre-first-fire case, scheduleAlignedRecurring writes
 * `nextOperationAt` directly.
 */
const calculateNextUpdateTime = (): string | null =>
  globalValues.spacetrackTrackerData.isActive
    ? new Date(Date.now() + SPACETRACK_UPDATE_INTERVAL_MS).toISOString()
    : null;

// Fetch decision helpers

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
 */
const emitEphemerisToTodayClients = async (): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const source: Source = "ISS"; // Ephemeris data is ISS-specific

  // Fetch ephemeris data once (same TLE data applies to ISS)
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

  // Check if any clients are viewing today for ISS
  const roomName = `${source}_${today}`;
  const io = getSocketIO();
  const room = io.sockets.adapter.rooms.get(roomName);

  if (!room?.size) {
    return; // No clients viewing ISS/today
  }

  emitDataUpdate({
    source,
    dataDate: today,
    dataUpdate: { type: "ephemeris", response: ephemerisData },
  });
  ConsoleLogger.debug(`Emitted ephemeris update to ${room.size} client(s) in ${roomName}`);
};

// Update execution

const performSpaceTrackUpdate = async (isManual: boolean = false): Promise<void> => {
  const startTime = Date.now();
  const attemptedAt = new Date(startTime).toISOString();

  updateState({
    lastOperationStartedAt: attemptedAt,
    totalOperations: globalValues.spacetrackTrackerData.totalOperations + 1,
  });

  emitSpacetrackInspectorUpdate();

  // Execute the update — dispatches to Space-Track on prod, prod-sync on followers.
  const result = await runUpdate();

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
  updateState({ nextOperationAt: calculateNextUpdateTime() });
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
    void performSpaceTrackUpdate(false);
  } else {
    ConsoleLogger.notice(
      `Skipping initial Space-Track fetch - ${skipReason} (threshold: ${dayjs.duration(SKIP_FETCH_THRESHOLD_MS).asMinutes().toFixed(0)} minutes)`
    );
  }

  scheduleAlignedRecurring();
  emitSpacetrackInspectorUpdate();
};

/**
 * Schedule the recurring 6h fire, aligned so the first fire lands on minute :12
 * or :48 and is at least `minDelayMs` from now. Subsequent fires are 6h later
 * (same minute mark, since 360 min is a clean multiple of 60 min). Replaces any
 * existing scheduled timer.
 *
 * `minDelayMs` is used by `triggerSpacetrackUpdate` to push the next aligned
 * fire ~6h out — so a manual trigger doesn't immediately trip a second fire on
 * the next clock-aligned minute.
 */
const scheduleAlignedRecurring = (minDelayMs: number = 0): void => {
  if (globalValues.spacetrackInterval) {
    clearInterval(globalValues.spacetrackInterval);
    globalValues.spacetrackInterval = null;
  }
  const alignmentDelayMs = msUntilNextSafeMinute(minDelayMs);
  const firstFireAt = new Date(Date.now() + alignmentDelayMs);
  updateState({ nextOperationAt: firstFireAt.toISOString() });
  globalValues.spacetrackInterval = setTimeout(() => {
    ConsoleLogger.debug("Running scheduled Space-Track TLE update (first aligned fire)");
    void performSpaceTrackUpdate(false);
    globalValues.spacetrackInterval = setInterval(() => {
      ConsoleLogger.debug("Running scheduled Space-Track TLE update");
      void performSpaceTrackUpdate(false);
    }, SPACETRACK_UPDATE_INTERVAL_MS);
  }, alignmentDelayMs);
  ConsoleLogger.info(
    `Space-Track scheduler aligned — next fire at ${firstFireAt.toISOString()} (:12/:48), then every ${dayjs.duration(SPACETRACK_UPDATE_INTERVAL_MS).asHours().toFixed(0)}h`
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

export const triggerSpacetrackUpdate = async (username: string): Promise<void> => {
  ConsoleLogger.notice(`Manual Space-Track update triggered by ${username}`);

  updateState({
    lastManualTriggerAt: new Date().toISOString(),
    lastManualTriggerBy: username,
  });

  if (globalValues.spacetrackTrackerData.isActive) {
    // Manual fire is happening now; push the next aligned fire ~6h out so we
    // don't double-hit Space-Track inside a single rate-limit window.
    scheduleAlignedRecurring(SPACETRACK_UPDATE_INTERVAL_MS);
  } else if (globalValues.spacetrackInterval) {
    clearInterval(globalValues.spacetrackInterval);
    globalValues.spacetrackInterval = null;
  }
  await performSpaceTrackUpdate(true);
};
