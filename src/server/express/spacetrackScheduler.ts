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
import getEphemera, { getLatestRecordCreatedAt } from "server/processing/ephemeris";
import { ConsoleLogger } from "../../utils/logging/consoleLogger";
import { globalValues } from "./global";
import { getCacheEntry, putCacheEntry } from "./cache-db";
import { emitSpacetrackInspectorUpdate, emitDataUpdate } from "./sockets";

dayjs.extend(duration);

// Space-Track provides comprehensive TLE data. We fetch 30 days at a time
// Run every 6 hours to be respectful of their API limits
const SPACETRACK_UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Skip initial fetch if latest record was created less than this threshold */
export const SKIP_FETCH_THRESHOLD_MS = 6 * 60 * 60 * 1000;
/** Cache folder and keys for persisted state */
const SPACETRACK_CACHE_FOLDER = "spacetrack";
const SPACETRACK_LAST_FETCH_KEY = "lastFetchResult";
const SPACETRACK_STATS_KEY = "persistedStats";

const updateState = (updates: Partial<SpaceTrackTrackerData>): void => {
  globalValues.spacetrackTrackerData = { ...globalValues.spacetrackTrackerData, ...updates };
};

const calculateNextUpdateTime = (): string | null =>
  globalValues.spacetrackTrackerData.isActive
    ? new Date(Date.now() + SPACETRACK_UPDATE_INTERVAL_MS).toISOString()
    : null;

/** Cache operations - two separate entries for fetch results and stats */

const getLastFetchResult = async (): Promise<SpaceTrackLastFetchResult | null> => {
  try {
    const entry = await getCacheEntry({
      folder: SPACETRACK_CACHE_FOLDER,
      identifier: SPACETRACK_LAST_FETCH_KEY,
    });
    return (entry?.data as SpaceTrackLastFetchResult) ?? null;
  } catch (error) {
    ConsoleLogger.warn("Could not retrieve last fetch result:", error);
    return null;
  }
};

const saveLastFetchResult = async (result: SpaceTrackLastFetchResult): Promise<void> => {
  try {
    await putCacheEntry({
      folder: SPACETRACK_CACHE_FOLDER,
      identifier: SPACETRACK_LAST_FETCH_KEY,
      data: result,
      metadata: { expiration: new Date(Date.now() + SPACETRACK_UPDATE_INTERVAL_MS).toISOString() },
    });
  } catch (error) {
    ConsoleLogger.warn("Could not save last fetch result:", error);
  }
};

const getPersistedStats = async (): Promise<SpaceTrackPersistedStats | null> => {
  try {
    const entry = await getCacheEntry({
      folder: SPACETRACK_CACHE_FOLDER,
      identifier: SPACETRACK_STATS_KEY,
    });
    return (entry?.data as SpaceTrackPersistedStats) ?? null;
  } catch (error) {
    ConsoleLogger.warn("Could not retrieve persisted stats:", error);
    return null;
  }
};

const savePersistedStats = async (): Promise<void> => {
  const stats: SpaceTrackPersistedStats = {
    totalOperations: globalValues.spacetrackTrackerData.totalOperations,
    successfulOperations: globalValues.spacetrackTrackerData.successfulOperations,
    failedOperations: globalValues.spacetrackTrackerData.failedOperations,
    lastManualTriggerAt: globalValues.spacetrackTrackerData.lastManualTriggerAt,
    lastManualTriggerBy: globalValues.spacetrackTrackerData.lastManualTriggerBy,
  };
  try {
    await putCacheEntry({
      folder: SPACETRACK_CACHE_FOLDER,
      identifier: SPACETRACK_STATS_KEY,
      data: stats,
      // Long expiration for cumulative stats (1 year)
      metadata: { expiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() },
    });
  } catch (error) {
    ConsoleLogger.warn("Could not save persisted stats:", error);
  }
};

const restoreStateFromCache = async (): Promise<void> => {
  // Restore last fetch result
  const lastFetch = await getLastFetchResult();
  if (lastFetch) {
    updateState({
      lastOperationStartedAt: lastFetch.attemptedAt,
      lastOperationCompletedAt: lastFetch.completedAt ?? null,
      lastOperationSuccess: lastFetch.success ?? null,
      lastFetchedEpoch: lastFetch.epoch ?? null,
      lastRecordsInserted: lastFetch.recordsInserted ?? null,
      lastRecordsSkipped: lastFetch.recordsSkipped ?? null,
      lastErrorMessage: lastFetch.errorMessage ?? null,
      lastErrorAt: lastFetch.success === false ? (lastFetch.completedAt ?? null) : null,
    });
  }

  // Restore cumulative stats
  const stats = await getPersistedStats();
  if (stats) {
    updateState({
      totalOperations: stats.totalOperations,
      successfulOperations: stats.successfulOperations,
      failedOperations: stats.failedOperations,
      lastManualTriggerAt: stats.lastManualTriggerAt,
      lastManualTriggerBy: stats.lastManualTriggerBy,
    });
  }
};

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
  const room = globalValues.socketio?.sockets?.adapter?.rooms?.get(roomName);

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

  // Record attempt before starting (persists across restarts)
  await saveLastFetchResult({ attemptedAt });
  await savePersistedStats();
  emitSpacetrackInspectorUpdate();

  // Execute the update
  const result = await updateFromSpaceTrack();

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
    await saveLastFetchResult({
      attemptedAt,
      completedAt,
      success: true,
      epoch: result.epoch ?? null,
      recordsInserted: result.recordsInserted,
      recordsSkipped: result.recordsSkipped,
    });
  } else {
    updateState({
      lastOperationSuccess: false,
      lastErrorMessage: result.errorMessage ?? "Unknown error",
      lastErrorAt: completedAt,
      failedOperations: globalValues.spacetrackTrackerData.failedOperations + 1,
    });
    await saveLastFetchResult({
      attemptedAt,
      completedAt,
      success: false,
      errorMessage: result.errorMessage ?? "Unknown error",
    });
  }
  await savePersistedStats();

  // Log result
  const prefix = isManual ? "(manual) " : "";
  if (result.success) {
    ConsoleLogger.debug(
      `Space-Track TLE update ${prefix}completed successfully in ${durationMs}ms, epoch: ${result.epoch}, inserted: ${result.recordsInserted}, skipped: ${result.recordsSkipped}`
    );
    // Emit updated ephemeris data to all clients viewing today
    await emitEphemerisToTodayClients();
  } else {
    ConsoleLogger.error(`Space-Track TLE update ${prefix}failed: ${result.errorMessage}`);
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

  // Restore previous state from cache
  await restoreStateFromCache();

  // Determine if initial fetch is needed
  const { shouldFetch, skipReason } = await determineShouldFetch();

  if (shouldFetch) {
    ConsoleLogger.debug("Starting initial Space-Track TLE update");
    void performSpaceTrackUpdate(false);
  } else {
    ConsoleLogger.notice(
      `Skipping initial Space-Track fetch - ${skipReason} (threshold: ${dayjs.duration(SKIP_FETCH_THRESHOLD_MS).asMinutes().toFixed(0)} minutes)`
    );
    updateState({ nextOperationAt: calculateNextUpdateTime() });
    emitSpacetrackInspectorUpdate();
  }

  globalValues.spacetrackInterval = setInterval(() => {
    ConsoleLogger.debug("Running scheduled Space-Track TLE update");
    void performSpaceTrackUpdate(false);
  }, SPACETRACK_UPDATE_INTERVAL_MS);
  ConsoleLogger.info(
    `Space-Track TLE update scheduler started (${dayjs.duration(SPACETRACK_UPDATE_INTERVAL_MS).asHours().toFixed(0)} hour interval)`
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

  await savePersistedStats();
  if (globalValues.spacetrackInterval) {
    clearInterval(globalValues.spacetrackInterval);
    globalValues.spacetrackInterval = null;
  }
  if (globalValues.spacetrackTrackerData.isActive) {
    globalValues.spacetrackInterval = setInterval(() => {
      ConsoleLogger.debug("Running scheduled Space-Track TLE update");
      void performSpaceTrackUpdate(false);
    }, SPACETRACK_UPDATE_INTERVAL_MS);
  }
  await performSpaceTrackUpdate(true);
};
