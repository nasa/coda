/**
 * Celestrak TLE Update Scheduler
 *
 * This module manages the scheduled fetching of TLE data from Celestrak.
 * It provides status tracking and exposes functions for the admin monitoring page.
 */
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { updateFromCelestrak } from "server/processing/ephemeris-celestrak";
import getEphemera, { getLatestRecordCreatedAt } from "server/processing/ephemeris";
import { ConsoleLogger } from "../../utils/logging/consoleLogger";
import { globalValues } from "./global";
import { getCacheEntry, putCacheEntry } from "./cache-db";
import { emitCelestrakInspectorUpdate, emitDataUpdate } from "./sockets";

dayjs.extend(duration);

// Celestrak updates every 2 hours, so we check every 3 hours to be nice
const CELESTRAK_UPDATE_INTERVAL_MS = 3 * 60 * 60 * 1000;
/** Skip initial fetch if latest record was created less than this threshold */
export const SKIP_FETCH_THRESHOLD_MS = 3 * 60 * 60 * 1000;
/** Cache folder and keys for persisted state */
const CELESTRAK_CACHE_FOLDER = "celestrak";
const CELESTRAK_LAST_FETCH_KEY = "lastFetchResult";
const CELESTRAK_STATS_KEY = "persistedStats";

const updateState = (updates: Partial<CelestrakTrackerData>): void => {
  globalValues.celestrakTrackerData = { ...globalValues.celestrakTrackerData, ...updates };
};

const calculateNextUpdateTime = (): string | null =>
  globalValues.celestrakTrackerData.isActive
    ? new Date(Date.now() + CELESTRAK_UPDATE_INTERVAL_MS).toISOString()
    : null;

/** Cache operations - two separate entries for fetch results and stats */

const getLastFetchResult = async (): Promise<CelestrakLastFetchResult | null> => {
  try {
    const entry = await getCacheEntry({
      folder: CELESTRAK_CACHE_FOLDER,
      identifier: CELESTRAK_LAST_FETCH_KEY,
    });
    return (entry?.data as CelestrakLastFetchResult) ?? null;
  } catch (error) {
    ConsoleLogger.warn("Could not retrieve last fetch result:", error);
    return null;
  }
};

const saveLastFetchResult = async (result: CelestrakLastFetchResult): Promise<void> => {
  try {
    await putCacheEntry({
      folder: CELESTRAK_CACHE_FOLDER,
      identifier: CELESTRAK_LAST_FETCH_KEY,
      data: result,
      metadata: { expiration: new Date(Date.now() + CELESTRAK_UPDATE_INTERVAL_MS).toISOString() },
    });
  } catch (error) {
    ConsoleLogger.warn("Could not save last fetch result:", error);
  }
};

const getPersistedStats = async (): Promise<CelestrakPersistedStats | null> => {
  try {
    const entry = await getCacheEntry({
      folder: CELESTRAK_CACHE_FOLDER,
      identifier: CELESTRAK_STATS_KEY,
    });
    return (entry?.data as CelestrakPersistedStats) ?? null;
  } catch (error) {
    ConsoleLogger.warn("Could not retrieve persisted stats:", error);
    return null;
  }
};

const savePersistedStats = async (): Promise<void> => {
  const stats: CelestrakPersistedStats = {
    totalOperations: globalValues.celestrakTrackerData.totalOperations,
    successfulOperations: globalValues.celestrakTrackerData.successfulOperations,
    failedOperations: globalValues.celestrakTrackerData.failedOperations,
    lastManualTriggerAt: globalValues.celestrakTrackerData.lastManualTriggerAt,
    lastManualTriggerBy: globalValues.celestrakTrackerData.lastManualTriggerBy,
  };
  try {
    await putCacheEntry({
      folder: CELESTRAK_CACHE_FOLDER,
      identifier: CELESTRAK_STATS_KEY,
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

const checkLastAttemptAge = (): CelestrakFetchDecision | null => {
  if (!globalValues.celestrakTrackerData.lastOperationStartedAt) return null;

  if (isWithinThreshold(globalValues.celestrakTrackerData.lastOperationStartedAt)) {
    const ageMs =
      Date.now() - new Date(globalValues.celestrakTrackerData.lastOperationStartedAt).getTime();
    return {
      shouldFetch: false,
      skipReason: `last fetch attempt was ${dayjs.duration(ageMs).asMinutes().toFixed(0)} minutes ago`,
    };
  }
  return null;
};

const checkLatestRecordAge = async (): Promise<CelestrakFetchDecision | null> => {
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
    ConsoleLogger.warn("Could not check latest record age, will fetch from Celestrak:", error);
  }
  return null;
};

/**
 * Determine if we should fetch from Celestrak on startup.
 *
 * This is primarily a precaution for local development environments where the server
 * may restart frequently (e.g., during active development). Without this check, we could
 * hammer Celestrak's servers with excessive requests and risk getting our IP banned.
 *
 * Checks in order:
 * 1. Last fetch attempt time (prevents hammering on dev restarts)
 * 2. Latest database record age (fallback check)
 */
const determineShouldFetch = async (): Promise<CelestrakFetchDecision> => {
  const lastAttemptCheck = checkLastAttemptAge();
  if (lastAttemptCheck) return lastAttemptCheck;

  const recordAgeCheck = await checkLatestRecordAge();
  if (recordAgeCheck) return recordAgeCheck;

  return { shouldFetch: true, skipReason: "" };
};

/**
 * Emit updated ephemeris data to all ISS clients viewing today's date.
 * Called after a successful Celestrak TLE update to push fresh data.
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

const performCelestrakUpdate = async (isManual: boolean = false): Promise<void> => {
  const startTime = Date.now();
  const attemptedAt = new Date(startTime).toISOString();

  updateState({
    lastOperationStartedAt: attemptedAt,
    totalOperations: globalValues.celestrakTrackerData.totalOperations + 1,
  });

  // Record attempt before starting (persists across restarts)
  await saveLastFetchResult({ attemptedAt });
  await savePersistedStats();
  emitCelestrakInspectorUpdate();

  // Execute the update
  const result = await updateFromCelestrak();

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
      successfulOperations: globalValues.celestrakTrackerData.successfulOperations + 1,
    });
    await saveLastFetchResult({
      attemptedAt,
      completedAt,
      success: true,
      epoch: result.epoch ?? null,
    });
  } else {
    updateState({
      lastOperationSuccess: false,
      lastErrorMessage: result.errorMessage ?? "Unknown error",
      lastErrorAt: completedAt,
      failedOperations: globalValues.celestrakTrackerData.failedOperations + 1,
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
      `Celestrak TLE update ${prefix}completed successfully in ${durationMs}ms, epoch: ${result.epoch}`
    );
    // Emit updated ephemeris data to all clients viewing today
    await emitEphemerisToTodayClients();
  } else {
    ConsoleLogger.error(`Celestrak TLE update ${prefix}failed: ${result.errorMessage}`);
  }

  // Finalize state and notify clients
  updateState({ nextOperationAt: calculateNextUpdateTime() });
  emitCelestrakInspectorUpdate();
};

// Scheduler control

export const startCelestrakScheduler = async (): Promise<void> => {
  if (globalValues.celestrakInterval) {
    ConsoleLogger.warn("Celestrak scheduler already running, stopping first");
    stopCelestrakScheduler();
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
    ConsoleLogger.debug("Starting initial Celestrak TLE update");
    void performCelestrakUpdate(false);
  } else {
    ConsoleLogger.notice(
      `Skipping initial Celestrak fetch - ${skipReason} (threshold: ${dayjs.duration(SKIP_FETCH_THRESHOLD_MS).asMinutes().toFixed(0)} minutes)`
    );
    updateState({ nextOperationAt: calculateNextUpdateTime() });
    emitCelestrakInspectorUpdate();
  }

  globalValues.celestrakInterval = setInterval(() => {
    ConsoleLogger.debug("Running scheduled Celestrak TLE update");
    void performCelestrakUpdate(false);
  }, CELESTRAK_UPDATE_INTERVAL_MS);
  ConsoleLogger.info(
    `Celestrak TLE update scheduler started (${dayjs.duration(CELESTRAK_UPDATE_INTERVAL_MS).asMinutes().toFixed(0)} minute interval)`
  );
};

export const stopCelestrakScheduler = (): void => {
  if (globalValues.celestrakInterval) {
    clearInterval(globalValues.celestrakInterval);
    globalValues.celestrakInterval = null;
  }
  updateState({
    isActive: false,
    nextOperationAt: null,
  });
  ConsoleLogger.info("Celestrak scheduler stopped");
  emitCelestrakInspectorUpdate();
};

export const triggerCelestrakUpdate = async (username: string): Promise<void> => {
  ConsoleLogger.notice(`Manual Celestrak update triggered by ${username}`);

  updateState({
    lastManualTriggerAt: new Date().toISOString(),
    lastManualTriggerBy: username,
  });

  await savePersistedStats();
  if (globalValues.celestrakInterval) {
    clearInterval(globalValues.celestrakInterval);
    globalValues.celestrakInterval = null;
  }
  if (globalValues.celestrakTrackerData.isActive) {
    globalValues.celestrakInterval = setInterval(() => {
      ConsoleLogger.debug("Running scheduled Celestrak TLE update");
      void performCelestrakUpdate(false);
    }, CELESTRAK_UPDATE_INTERVAL_MS);
  }
  await performCelestrakUpdate(true);
};
