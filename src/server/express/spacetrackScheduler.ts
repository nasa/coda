/**
 * Space-Track TLE Update Scheduler
 *
 * Fetches TLE data every 6 h at minutes :12 or :48 (Space-Track asks users to
 * avoid :00 and :30). Skips the initial fetch if the DB already has recent data.
 * Non-prod instances (EPHEMERIS_SYNC_FROM_URL) sync from a remote CODA instead.
 *
 * Space-Track has strict rate limits — do not increase the fetch frequency.
 */
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { updateFromSpaceTrack } from "server/processing/ephemeris-spacetrack";
import { syncEphemerisFromRemote } from "server/processing/ephemeris-sync";
import getEphemera, { getLatestRecordCreatedAt } from "server/processing/ephemeris";
import { ConsoleLogger } from "../../utils/logging/consoleLogger";
import { globalValues, getSocketIO } from "./global";
import { emitSpacetrackInspectorUpdate, emitDataUpdate } from "./sockets";

dayjs.extend(duration);

const SPACETRACK_UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const SKIP_FETCH_THRESHOLD_MS = 6 * 60 * 60 * 1000;
/** Minutes past the hour safe for Space-Track requests (avoid :00 and :30). */
const SAFE_MINUTES = [12, 48] as const;

/** Ms until the next safe minute that is at least `minDelayMs` away. */
const msUntilNextSafeMinute = (minDelayMs: number = 0): number => {
  const now = Date.now();
  const earliest = new Date(now + minDelayMs);
  const minute = earliest.getMinutes();
  const target = SAFE_MINUTES.find((m) => m > minute) ?? SAFE_MINUTES[0] + 60;
  const targetDate = new Date(earliest);
  targetDate.setMinutes(target, 0, 0);
  return targetDate.getTime() - now;
};

const runUpdate = (): Promise<SpaceTrackUpdateResult> =>
  process.env.EPHEMERIS_SYNC_FROM_URL ? syncEphemerisFromRemote() : updateFromSpaceTrack();

const updateState = (updates: Partial<SpaceTrackTrackerData>): void => {
  globalValues.spacetrackTrackerData = { ...globalValues.spacetrackTrackerData, ...updates };
};

const calculateNextUpdateTime = (): string | null =>
  globalValues.spacetrackTrackerData.isActive
    ? new Date(Date.now() + SPACETRACK_UPDATE_INTERVAL_MS).toISOString()
    : null;

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
 * Decide whether to fetch on startup. Checks last attempt time first,
 * then falls back to latest DB record age.
 */
const determineShouldFetch = async (): Promise<SpaceTrackFetchDecision> => {
  const lastAttemptCheck = checkLastAttemptAge();
  if (lastAttemptCheck) return lastAttemptCheck;

  const recordAgeCheck = await checkLatestRecordAge();
  if (recordAgeCheck) return recordAgeCheck;

  return { shouldFetch: true, skipReason: "" };
};

/** Emit updated ephemeris data to all ISS clients viewing today. */
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

  const roomName = `${source}_${today}`;
  const io = getSocketIO();
  const room = io.sockets.adapter.rooms.get(roomName);

  if (!room?.size) {
    return;
  }

  emitDataUpdate({
    source,
    dataDate: today,
    dataUpdate: { type: "ephemeris", response: ephemerisData },
  });
  ConsoleLogger.debug(`Emitted ephemeris update to ${room.size} client(s) in ${roomName}`);
};

/** Run the TLE update, record the result, and notify connected clients. */
const performSpaceTrackUpdate = async (isManual: boolean = false): Promise<void> => {
  const startTime = Date.now();
  const attemptedAt = new Date(startTime).toISOString();

  updateState({
    lastOperationStartedAt: attemptedAt,
    totalOperations: globalValues.spacetrackTrackerData.totalOperations + 1,
  });

  emitSpacetrackInspectorUpdate();

  const result = await runUpdate();

  const endTime = Date.now();
  const completedAt = new Date(endTime).toISOString();
  const durationMs = endTime - startTime;

  updateState({
    lastOperationCompletedAt: completedAt,
    lastOperationDurationMs: durationMs,
  });

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

  const prefix = isManual ? "(manual) " : "";
  if (result.success) {
    ConsoleLogger.debug(
      `Space-Track TLE update${prefix} completed successfully in ${durationMs}ms, epoch: ${result.epoch}, inserted: ${result.recordsInserted}, skipped: ${result.recordsSkipped}`
    );
    await emitEphemerisToTodayClients();
  } else {
    ConsoleLogger.error(`Space-Track TLE update${prefix} failed: ${result.errorMessage}`);
  }

  updateState({ nextOperationAt: calculateNextUpdateTime() });
  emitSpacetrackInspectorUpdate();
};

export const startSpacetrackScheduler = async (): Promise<void> => {
  if (globalValues.spacetrackInterval) {
    ConsoleLogger.warn("Space-Track scheduler already running, stopping first");
    stopSpacetrackScheduler();
  }

  updateState({
    isActive: true,
    startedAt: new Date().toISOString(),
  });

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
 * (Re)schedule the recurring 6 h timer so the next fire lands on a safe minute.
 * `minDelayMs` pushes the earliest allowed fire forward (used after manual triggers
 * to avoid two fetches within the same 6 h window).
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
    scheduleAlignedRecurring(SPACETRACK_UPDATE_INTERVAL_MS);
  } else if (globalValues.spacetrackInterval) {
    clearInterval(globalValues.spacetrackInterval);
    globalValues.spacetrackInterval = null;
  }
  await performSpaceTrackUpdate(true);
};
