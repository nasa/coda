import { globalValues } from "./global";
import getEphemera, { getLatestRecordCreatedAt } from "server/processing/ephemeris";
import { updateFromSpaceTrack } from "server/processing/ephemeris-spacetrack";
import { syncEphemerisFromRemote } from "server/processing/ephemeris-sync";
import { emitSpacetrackInspectorUpdate, emitDataUpdate } from "./sockets";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("server/processing/ephemeris", () => ({
  default: vi.fn(),
  getLatestRecordCreatedAt: vi.fn(),
}));

vi.mock("server/processing/ephemeris-spacetrack", () => ({
  updateFromSpaceTrack: vi.fn(),
}));

vi.mock("server/processing/ephemeris-sync", () => ({
  syncEphemerisFromRemote: vi.fn(),
}));

vi.mock("./sockets", () => ({
  emitSpacetrackInspectorUpdate: vi.fn(),
  emitDataUpdate: vi.fn(),
}));

vi.mock("./global", () => {
  const makeTrackerData = (): SpaceTrackTrackerData => ({
    isActive: false,
    intervalMs: 6 * 60 * 60 * 1000,
    startedAt: null,
    nextOperationAt: null,
    lastOperationStartedAt: null,
    lastOperationCompletedAt: null,
    lastOperationDurationMs: null,
    lastOperationSuccess: null,
    lastSuccessAt: null,
    lastFetchedEpoch: null,
    lastRecordsInserted: null,
    lastRecordsSkipped: null,
    lastErrorMessage: null,
    lastErrorAt: null,
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    lastManualTriggerAt: null,
    lastManualTriggerBy: null,
  });

  const gv = {
    spacetrackInterval: null as ReturnType<typeof setTimeout> | null,
    spacetrackTrackerData: makeTrackerData(),
  };

  return { globalValues: gv };
});

// Import after mocks are hoisted
import {
  startSpacetrackScheduler,
  stopSpacetrackScheduler,
  triggerSpacetrackUpdate,
  SKIP_FETCH_THRESHOLD_MS,
} from "./spacetrackScheduler";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SUCCESS_RESULT: SpaceTrackUpdateResult = {
  success: true,
  epoch: "2026-01-01T00:00:00Z",
  recordsInserted: 100,
  recordsSkipped: 5,
};

const EMPTY_FETCH_RESPONSE: FetchResponse<EphemerisEntry[]> = {
  data: [],
  fetchMetadata: { success: true, timestamp: new Date().toISOString() },
};

const FAILURE_RESULT: SpaceTrackUpdateResult = {
  success: false,
  errorMessage: "Network error",
  epoch: null,
  recordsInserted: 0,
  recordsSkipped: 0,
};

/** Reset globalValues to a clean initial state before each test. */
const resetGlobalValues = (): void => {
  (globalValues as Record<string, unknown>).spacetrackInterval = null;
  globalValues.spacetrackTrackerData = {
    isActive: false,
    intervalMs: 6 * 60 * 60 * 1000,
    startedAt: null,
    nextOperationAt: null,
    lastOperationStartedAt: null,
    lastOperationCompletedAt: null,
    lastOperationDurationMs: null,
    lastOperationSuccess: null,
    lastSuccessAt: null,
    lastFetchedEpoch: null,
    lastRecordsInserted: null,
    lastRecordsSkipped: null,
    lastErrorMessage: null,
    lastErrorAt: null,
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    lastManualTriggerAt: null,
    lastManualTriggerBy: null,
  };
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("spacetrackScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    resetGlobalValues();
    delete process.env.EPHEMERIS_SYNC_FROM_URL;

    // Default: DB has a fresh record → initial fetch is skipped, keeping most
    // tests focused on their own concern rather than also exercising the fetch path.
    vi.mocked(getLatestRecordCreatedAt).mockResolvedValue(new Date());
    vi.mocked(updateFromSpaceTrack).mockResolvedValue(SUCCESS_RESULT);
    vi.mocked(syncEphemerisFromRemote).mockResolvedValue(SUCCESS_RESULT);
    // getEphemera returns an empty response by default. emitDataUpdate is still
    // called on success (room membership is no longer checked), but since
    // emitDataUpdate is mocked, it has no real side-effects.
    vi.mocked(getEphemera).mockResolvedValue(EMPTY_FETCH_RESPONSE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Constants ──────────────────────────────────────────────────────────────

  it("SKIP_FETCH_THRESHOLD_MS equals 6 hours", () => {
    expect(SKIP_FETCH_THRESHOLD_MS).toBe(6 * 60 * 60 * 1000);
  });

  // ── startSpacetrackScheduler ───────────────────────────────────────────────

  describe("startSpacetrackScheduler", () => {
    it("sets isActive=true and records a startedAt ISO timestamp", async () => {
      await startSpacetrackScheduler();

      expect(globalValues.spacetrackTrackerData.isActive).toBe(true);
      expect(globalValues.spacetrackTrackerData.startedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );
    });

    it("registers a recurring timer and sets nextOperationAt", async () => {
      await startSpacetrackScheduler();

      expect(globalValues.spacetrackInterval).not.toBeNull();
      expect(globalValues.spacetrackTrackerData.nextOperationAt).not.toBeNull();
    });

    it("emits an inspector update", async () => {
      await startSpacetrackScheduler();

      expect(emitSpacetrackInspectorUpdate).toHaveBeenCalled();
    });

    it("skips initial fetch when latest DB record is within the threshold", async () => {
      // getLatestRecordCreatedAt already returns new Date() (< threshold)
      await startSpacetrackScheduler();

      expect(updateFromSpaceTrack).not.toHaveBeenCalled();
    });

    it("skips initial fetch when lastOperationStartedAt is within the threshold", async () => {
      // Simulate a very recent prior attempt recorded in state
      globalValues.spacetrackTrackerData.lastOperationStartedAt = new Date().toISOString();

      await startSpacetrackScheduler();

      expect(updateFromSpaceTrack).not.toHaveBeenCalled();
    });

    it("performs initial fetch when no DB records exist (null)", async () => {
      vi.mocked(getLatestRecordCreatedAt).mockResolvedValue(null);

      await startSpacetrackScheduler();
      // performSpaceTrackUpdate is fire-and-forget (void); flush microtask queue
      await Promise.resolve();

      expect(updateFromSpaceTrack).toHaveBeenCalledTimes(1);
    });

    it("performs initial fetch when latest DB record is older than the threshold", async () => {
      const oldDate = new Date(Date.now() - SKIP_FETCH_THRESHOLD_MS - 1000);
      vi.mocked(getLatestRecordCreatedAt).mockResolvedValue(oldDate);

      await startSpacetrackScheduler();
      await Promise.resolve();

      expect(updateFromSpaceTrack).toHaveBeenCalledTimes(1);
    });

    it("stops the existing scheduler before restarting when already active", async () => {
      // Prime an existing interval so the guard branch fires
      (globalValues as Record<string, unknown>).spacetrackInterval = setTimeout(
        () => {},
        99999
      ) as unknown as ReturnType<typeof setTimeout>;

      await startSpacetrackScheduler();

      // After restart isActive must still be true and a new interval registered
      expect(globalValues.spacetrackTrackerData.isActive).toBe(true);
      expect(globalValues.spacetrackInterval).not.toBeNull();
    });

    it("calls syncEphemerisFromRemote instead of updateFromSpaceTrack when EPHEMERIS_SYNC_FROM_URL is set", async () => {
      process.env.EPHEMERIS_SYNC_FROM_URL = "https://remote.example.com";
      vi.mocked(getLatestRecordCreatedAt).mockResolvedValue(null);

      await startSpacetrackScheduler();
      await Promise.resolve();

      expect(syncEphemerisFromRemote).toHaveBeenCalledTimes(1);
      expect(updateFromSpaceTrack).not.toHaveBeenCalled();
    });

    it("fires the recurring timer at a :12/:48 safe minute and triggers an update", async () => {
      // Pin the clock so we know when the next safe minute is.
      // Set current minute to :05 → next safe minute is :12 → delay = 7 min.
      const base = new Date("2026-01-01T10:05:00.000Z");
      vi.setSystemTime(base);
      vi.mocked(getLatestRecordCreatedAt).mockResolvedValue(new Date());

      await startSpacetrackScheduler();

      // Advance past the initial setTimeout delay (7 min + buffer)
      await vi.advanceTimersByTimeAsync(8 * 60 * 1000);

      expect(updateFromSpaceTrack).toHaveBeenCalledTimes(1);
    });

    it("fires the recurring setInterval every 6 hours after the first safe-minute fire", async () => {
      const base = new Date("2026-01-01T10:05:00.000Z");
      vi.setSystemTime(base);
      vi.mocked(getLatestRecordCreatedAt).mockResolvedValue(new Date());

      await startSpacetrackScheduler();

      // Trigger the outer setTimeout (≈7 min to :12)
      await vi.advanceTimersByTimeAsync(8 * 60 * 1000);
      // Trigger two subsequent setInterval fires
      await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000);
      await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000);

      expect(updateFromSpaceTrack).toHaveBeenCalledTimes(3);
    });
  });

  // ── stopSpacetrackScheduler ────────────────────────────────────────────────

  describe("stopSpacetrackScheduler", () => {
    it("sets isActive=false and clears nextOperationAt", async () => {
      await startSpacetrackScheduler();

      stopSpacetrackScheduler();

      expect(globalValues.spacetrackTrackerData.isActive).toBe(false);
      expect(globalValues.spacetrackTrackerData.nextOperationAt).toBeNull();
    });

    it("nulls out spacetrackInterval", async () => {
      await startSpacetrackScheduler();
      expect(globalValues.spacetrackInterval).not.toBeNull();

      stopSpacetrackScheduler();

      expect(globalValues.spacetrackInterval).toBeNull();
    });

    it("emits an inspector update", async () => {
      await startSpacetrackScheduler();
      vi.mocked(emitSpacetrackInspectorUpdate).mockClear();

      stopSpacetrackScheduler();

      expect(emitSpacetrackInspectorUpdate).toHaveBeenCalledTimes(1);
    });

    it("is safe to call when no scheduler is running (no throw)", () => {
      expect(() => stopSpacetrackScheduler()).not.toThrow();
      expect(globalValues.spacetrackTrackerData.isActive).toBe(false);
    });

    it("prevents the recurring timer from firing after stop", async () => {
      const base = new Date("2026-01-01T10:05:00.000Z");
      vi.setSystemTime(base);

      await startSpacetrackScheduler();
      stopSpacetrackScheduler();

      // Advance well past where the first timer would have fired
      await vi.advanceTimersByTimeAsync(8 * 60 * 1000);

      expect(updateFromSpaceTrack).not.toHaveBeenCalled();
    });
  });

  // ── triggerSpacetrackUpdate ────────────────────────────────────────────────

  describe("triggerSpacetrackUpdate", () => {
    it("records lastManualTriggerBy and lastManualTriggerAt before the fetch", async () => {
      const before = Date.now();

      await triggerSpacetrackUpdate("alice");

      expect(globalValues.spacetrackTrackerData.lastManualTriggerBy).toBe("alice");
      const triggerTime = new Date(
        globalValues.spacetrackTrackerData.lastManualTriggerAt!
      ).getTime();
      expect(triggerTime).toBeGreaterThanOrEqual(before);
    });

    it("calls updateFromSpaceTrack immediately", async () => {
      await triggerSpacetrackUpdate("alice");

      expect(updateFromSpaceTrack).toHaveBeenCalledTimes(1);
    });

    it("increments totalOperations and successfulOperations on success", async () => {
      await triggerSpacetrackUpdate("alice");

      expect(globalValues.spacetrackTrackerData.totalOperations).toBe(1);
      expect(globalValues.spacetrackTrackerData.successfulOperations).toBe(1);
    });

    it("sets lastOperationSuccess=true and records epoch/counts on success", async () => {
      await triggerSpacetrackUpdate("alice");

      expect(globalValues.spacetrackTrackerData.lastOperationSuccess).toBe(true);
      expect(globalValues.spacetrackTrackerData.lastFetchedEpoch).toBe(SUCCESS_RESULT.epoch);
      expect(globalValues.spacetrackTrackerData.lastRecordsInserted).toBe(
        SUCCESS_RESULT.recordsInserted
      );
      expect(globalValues.spacetrackTrackerData.lastRecordsSkipped).toBe(
        SUCCESS_RESULT.recordsSkipped
      );
    });

    it("sets lastOperationSuccess=false, records errorMessage, and increments failedOperations on failure", async () => {
      vi.mocked(updateFromSpaceTrack).mockResolvedValueOnce(FAILURE_RESULT);

      await triggerSpacetrackUpdate("bob");

      expect(globalValues.spacetrackTrackerData.lastOperationSuccess).toBe(false);
      expect(globalValues.spacetrackTrackerData.lastErrorMessage).toBe("Network error");
      expect(globalValues.spacetrackTrackerData.failedOperations).toBe(1);
      expect(globalValues.spacetrackTrackerData.successfulOperations).toBe(0);
    });

    it("records lastOperationCompletedAt and lastOperationDurationMs", async () => {
      await triggerSpacetrackUpdate("alice");

      expect(globalValues.spacetrackTrackerData.lastOperationCompletedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T/
      );
      expect(globalValues.spacetrackTrackerData.lastOperationDurationMs).toBeGreaterThanOrEqual(0);
    });

    it("does not disturb the running scheduler interval", async () => {
      await startSpacetrackScheduler();
      const intervalBefore = globalValues.spacetrackInterval;

      await triggerSpacetrackUpdate("alice");

      expect(globalValues.spacetrackInterval).toBe(intervalBefore);
      expect(globalValues.spacetrackTrackerData.isActive).toBe(true);
    });

    it("calls syncEphemerisFromRemote instead of updateFromSpaceTrack when EPHEMERIS_SYNC_FROM_URL is set", async () => {
      process.env.EPHEMERIS_SYNC_FROM_URL = "https://remote.example.com";

      await triggerSpacetrackUpdate("alice");

      expect(syncEphemerisFromRemote).toHaveBeenCalledTimes(1);
      expect(updateFromSpaceTrack).not.toHaveBeenCalled();
    });
  });

  // ── emitEphemerisToTodayClients (via performSpaceTrackUpdate) ──────────────

  describe("emitEphemerisToTodayClients", () => {
    const today = new Date().toISOString().split("T")[0];

    it("calls emitDataUpdate with ISS source and today's date on a successful update", async () => {
      await triggerSpacetrackUpdate("alice");

      expect(emitDataUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ source: "ISS", dataDate: today })
      );
    });

    it("does NOT call emitDataUpdate when getEphemera returns undefined data (null-like guard)", async () => {
      // Simulate getEphemera resolving to a falsy response
      vi.mocked(getEphemera).mockResolvedValueOnce(
        null as unknown as FetchResponse<EphemerisEntry[]>
      );

      await triggerSpacetrackUpdate("alice");

      expect(emitDataUpdate).not.toHaveBeenCalled();
    });

    it("does NOT call emitDataUpdate on a failed update", async () => {
      vi.mocked(updateFromSpaceTrack).mockResolvedValueOnce(FAILURE_RESULT);

      await triggerSpacetrackUpdate("alice");

      expect(emitDataUpdate).not.toHaveBeenCalled();
    });
  });
});
