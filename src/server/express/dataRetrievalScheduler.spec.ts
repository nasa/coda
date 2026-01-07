import { vi } from "vitest";
import type { Mock } from "vitest";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getSourceDateDataType, forceRefreshDataType } from "./dataRetrievalScheduler";
import { getCacheEntry, putCacheEntry } from "server/express/cache-db";
import { globalValues } from "./global";
import { emitDataUpdate } from "./sockets";
import getVideoData from "server/processing/io-videos";

dayjs.extend(duration);

// Import for mocking purposes (need to mock to prevent actual module execution)
import "server/processing/daynight";
import "server/processing/ephemeris";
import "server/processing/io-videos";
import "server/processing/io-photos";
import "server/processing/gps";
import "server/processing/mediaMtx";
import "server/processing/graphs";
import "server/processing/wikiData";

vi.mock("server/express/cache-db");
vi.mock("./sockets");
vi.mock("server/processing/daynight");
vi.mock("server/processing/ephemeris");
vi.mock("server/processing/io-videos");
vi.mock("server/processing/io-photos");
vi.mock("server/processing/gps");
vi.mock("server/processing/mediaMtx");
vi.mock("server/processing/graphs");
vi.mock("server/processing/wikiData");
vi.mock("./global", () => ({
  globalValues: {
    socketio: null,
    serverSocketStatus: {
      visitorsData: [],
    },
    orm: {
      em: {},
    },
    socketInterval: null,
    appVersion: null,
    fetchTrackers: {},
  } as GlobalValues,
}));

const getCacheEntryMock = getCacheEntry as Mock;
const putCacheEntryMock = putCacheEntry as Mock;
const emitDataUpdateMock = emitDataUpdate as Mock;
const getVideoDataMock = getVideoData as Mock;

/**
 * Testing Notes:
 *
 * Background Fetches:
 * The dataRetrievalScheduler uses "fire-and-forget" promises for background fetches,
 * meaning performBackgroundFetch() is called without await. To test these properly:
 *
 * 1. Use `await vi.advanceTimersByTimeAsync(0)` to flush the microtask queue
 * 2. Use `await Promise.resolve()` for an additional microtask flush
 *
 * This ensures the fire-and-forget promises have executed before making assertions.
 */

describe("dataRetrievalScheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    // Reset global state
    globalValues.fetchTrackers = {};
  });

  afterEach(() => {
    // Clear all timeouts
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe("getSourceDateDataType - Caching Logic", () => {
    const mockDataFetchConfig: FetchConfig = {
      type: "videos",
      getDataFunction: vi.fn(),
      refreshIntervalMs: dayjs.duration(15, "minutes").asMilliseconds(),
      refreshIntervalTodayMs: dayjs.duration(2, "minutes").asMilliseconds(),
      fetchTimeoutMs: dayjs.duration(30, "seconds").asMilliseconds(),
      enableCacheUse: true,
    };

    const mockSuccessResponse: FetchResponse<unknown> = {
      data: { videos: [{ id: "video1", title: "Test Video" }] },
      fetchMetadata: {
        success: true,
        timestamp: new Date().toISOString(),
      },
    };

    const mockFailureResponse: FetchResponse<unknown> = {
      data: null,
      fetchMetadata: {
        success: false,
        error: "Failed to fetch data",
        timestamp: new Date().toISOString(),
      },
    };

    it("returns cached data when cache is valid (not expired)", async () => {
      const futureExpiration = new Date(
        Date.now() + dayjs.duration(10, "minutes").asMilliseconds()
      ).toISOString(); // 10 min future
      const cachedData = {
        data: mockSuccessResponse,
        metadata: {
          expiration: futureExpiration,
        },
      };

      getCacheEntryMock.mockResolvedValue(cachedData as CacheRecord_db_type);

      const result = await getSourceDateDataType({
        source: "ISS",
        dateWanted: "2025-01-01",
        dataFetchConfig: mockDataFetchConfig,
        autoRefresh: false,
      });

      expect(result).toEqual(mockSuccessResponse);
      expect(getCacheEntryMock).toHaveBeenCalledWith({
        folder: "socketDataCache/ISS/2025-01-01",
        identifier: "videos",
      });
      expect(mockDataFetchConfig.getDataFunction).not.toHaveBeenCalled();
    });

    it("expired cache case initiates immediate background fetch while returning stale data", async () => {
      vi.useFakeTimers();
      const pastExpiration = new Date(
        Date.now() - dayjs.duration(10, "minutes").asMilliseconds()
      ).toISOString(); // 10 min past
      const cachedData = {
        data: mockSuccessResponse,
        metadata: {
          expiration: pastExpiration,
        },
      };

      const newSuccessResponse: FetchResponse<unknown> = {
        data: { videos: [{ id: "video2", title: "New Video" }] },
        fetchMetadata: {
          success: true,
          timestamp: new Date().toISOString(),
        },
      };

      getCacheEntryMock.mockResolvedValue(cachedData as CacheRecord_db_type);
      (mockDataFetchConfig.getDataFunction as Mock).mockResolvedValue(newSuccessResponse);

      const result = await getSourceDateDataType({
        source: "ISS",
        dateWanted: "2025-01-01",
        dataFetchConfig: mockDataFetchConfig,
        autoRefresh: true,
      });

      // Should return old cached data immediately (stale-while-revalidate pattern)
      expect(result).toEqual(mockSuccessResponse);

      // Wait for the immediate background fetch to execute (NOT a scheduled timeout)
      // This is a fire-and-forget promise that starts immediately, not on a timer
      await vi.advanceTimersByTimeAsync(0); // Flush microtasks
      await Promise.resolve(); // Additional microtask flush

      // Verify background fetch was triggered immediately
      expect(mockDataFetchConfig.getDataFunction).toHaveBeenCalledWith({
        source: "ISS",
        dateWanted: "2025-01-01",
      });
    });

    it("returns null when no cache exists and triggers background fetch", async () => {
      vi.useFakeTimers();
      getCacheEntryMock.mockResolvedValue(null);
      (mockDataFetchConfig.getDataFunction as Mock).mockResolvedValue(mockSuccessResponse);

      const result = await getSourceDateDataType({
        source: "ISS",
        dateWanted: "2025-01-01",
        dataFetchConfig: mockDataFetchConfig,
        autoRefresh: true,
      });

      expect(result).toBeNull();

      // Wait for background fetch fire-and-forget promise to execute
      await vi.advanceTimersByTimeAsync(0); // Flush microtasks
      await Promise.resolve(); // Additional microtask flush

      expect(mockDataFetchConfig.getDataFunction).toHaveBeenCalled();
    });

    it("skips cache when enableCacheUse is false", async () => {
      const noCacheConfig: FetchConfig = {
        ...mockDataFetchConfig,
        enableCacheUse: false,
      };

      (noCacheConfig.getDataFunction as Mock).mockResolvedValue(mockSuccessResponse);

      const result = await getSourceDateDataType({
        source: "ISS",
        dateWanted: "2025-01-01",
        dataFetchConfig: noCacheConfig,
        autoRefresh: true,
      });

      expect(result).toEqual(mockSuccessResponse);
      expect(getCacheEntryMock).not.toHaveBeenCalled();
      expect(noCacheConfig.getDataFunction).toHaveBeenCalled();
    });

    it("does not trigger duplicate fetches when already fetching", async () => {
      vi.useFakeTimers();
      getCacheEntryMock.mockResolvedValue(null);

      // Simulate a slow fetch (5 seconds)
      (mockDataFetchConfig.getDataFunction as Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve(mockSuccessResponse),
              dayjs.duration(5, "seconds").asMilliseconds()
            )
          )
      );

      // First call - no cache, triggers background fetch
      const result1 = await getSourceDateDataType({
        source: "ISS",
        dateWanted: "2025-01-01",
        dataFetchConfig: mockDataFetchConfig,
        autoRefresh: true,
      });

      // First call returns null immediately (no cache available)
      expect(result1).toBeNull();

      // Flush microtasks to start background fetch
      await vi.advanceTimersByTimeAsync(0);

      // Second call while first background fetch is still in progress (hasn't reached 5s yet)
      const result2 = await getSourceDateDataType({
        source: "ISS",
        dateWanted: "2025-01-01",
        dataFetchConfig: mockDataFetchConfig,
        autoRefresh: true,
      });

      // Second call also returns null immediately
      expect(result2).toBeNull();

      // Key assertion: Even though we called getSourceDateDataType twice,
      // the background fetch should only have been initiated ONCE
      // (the second call detected the first was already fetching)
      expect(mockDataFetchConfig.getDataFunction).toHaveBeenCalledTimes(1);
    });

    it("updates cache after successful background fetch", async () => {
      vi.useFakeTimers();
      const pastExpiration = new Date(
        Date.now() - dayjs.duration(10, "minutes").asMilliseconds()
      ).toISOString();
      const cachedData = {
        data: mockSuccessResponse,
        metadata: {
          expiration: pastExpiration,
        },
      };

      getCacheEntryMock.mockResolvedValue(cachedData as CacheRecord_db_type);
      (mockDataFetchConfig.getDataFunction as Mock).mockResolvedValue(mockSuccessResponse);

      await getSourceDateDataType({
        source: "ISS",
        dateWanted: "2025-01-01",
        dataFetchConfig: mockDataFetchConfig,
        autoRefresh: true,
      });

      // Let background fetch complete (fire-and-forget promise)
      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();

      expect(putCacheEntryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: "socketDataCache/ISS/2025-01-01",
          identifier: "videos",
          data: mockSuccessResponse,
          metadata: expect.objectContaining({
            expiration: expect.any(String),
          }),
        })
      );
    });

    it("preserves old cache data when fetch fails", async () => {
      vi.useFakeTimers();
      const pastExpiration = new Date(
        Date.now() - dayjs.duration(10, "minutes").asMilliseconds()
      ).toISOString();
      const oldCachedData = {
        data: mockSuccessResponse,
        metadata: {
          expiration: pastExpiration,
        },
      };

      getCacheEntryMock.mockResolvedValue(oldCachedData as CacheRecord_db_type);
      (mockDataFetchConfig.getDataFunction as Mock).mockResolvedValue(mockFailureResponse);

      await getSourceDateDataType({
        source: "ISS",
        dateWanted: "2025-01-01",
        dataFetchConfig: mockDataFetchConfig,
        autoRefresh: true,
      });

      // Let background fetch complete (fire-and-forget promise)
      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();

      // Should preserve old data when new fetch fails
      expect(putCacheEntryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: oldCachedData.data, // Old data preserved
          metadata: expect.objectContaining({
            expiration: pastExpiration, // Old expiration preserved
          }),
        })
      );
    });

    it("emits data update when data changes", async () => {
      vi.useFakeTimers();
      const pastExpiration = new Date(
        Date.now() - dayjs.duration(10, "minutes").asMilliseconds()
      ).toISOString();
      const oldData = {
        data: { videos: [{ id: "video1", title: "Test Video" }] },
        metadata: { success: true, timestamp: new Date().toISOString() },
      };
      const newData = {
        data: { videos: [{ id: "video2", title: "New Video" }] },
        metadata: { success: true, timestamp: new Date().toISOString() },
      };

      const cachedData = {
        data: oldData,
        metadata: {
          expiration: pastExpiration,
        },
      };

      getCacheEntryMock.mockResolvedValue(cachedData as CacheRecord_db_type);
      (mockDataFetchConfig.getDataFunction as Mock).mockResolvedValue(newData);

      await getSourceDateDataType({
        source: "ISS",
        dateWanted: "2025-01-01",
        dataFetchConfig: mockDataFetchConfig,
        autoRefresh: true,
      });

      // Let background fetch complete (fire-and-forget promise)
      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();

      expect(emitDataUpdateMock).toHaveBeenCalledWith({
        source: "ISS",
        dataDate: "2025-01-01",
        dataUpdate: { type: "videos", response: newData },
      });
    });

    it("does not emit when data is unchanged", async () => {
      vi.useFakeTimers();
      const pastExpiration = new Date(
        Date.now() - dayjs.duration(10, "minutes").asMilliseconds()
      ).toISOString();
      const sameData = {
        data: { videos: [{ id: "video1", title: "Test Video" }] },
        metadata: { success: true, timestamp: new Date().toISOString() },
      };

      const cachedData = {
        data: sameData,
        metadata: {
          expiration: pastExpiration,
        },
      };

      getCacheEntryMock.mockResolvedValue(cachedData as CacheRecord_db_type);
      (mockDataFetchConfig.getDataFunction as Mock).mockResolvedValue(sameData);

      await getSourceDateDataType({
        source: "ISS",
        dateWanted: "2025-01-01",
        dataFetchConfig: mockDataFetchConfig,
        autoRefresh: true,
      });

      // Let background fetch complete (fire-and-forget promise)
      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();

      expect(emitDataUpdateMock).not.toHaveBeenCalled();
    });

    it("schedules refresh timeout for valid cache when autoRefresh is enabled", async () => {
      vi.useFakeTimers();
      const futureExpiration = new Date(
        Date.now() + dayjs.duration(10, "minutes").asMilliseconds()
      ).toISOString();
      const cachedData = {
        data: mockSuccessResponse,
        metadata: {
          expiration: futureExpiration,
        },
      };

      getCacheEntryMock.mockResolvedValue(cachedData as CacheRecord_db_type);

      await getSourceDateDataType({
        source: "ISS",
        dateWanted: "2025-01-01",
        dataFetchConfig: mockDataFetchConfig,
        autoRefresh: true,
      });

      // Check that a timeout was scheduled
      const tracker = globalValues.fetchTrackers?.["ISS"]?.["2025-01-01"]?.["videos"];
      expect(tracker?.timeoutObject).toBeDefined();
      expect(tracker?.nextTimeoutTriggerAt).toBeDefined();
      expect(tracker?.timeoutDelayMs).toBeDefined();
      expect(tracker?.timeoutCreatedAt).toBeDefined();
    });

    it("does not schedule refresh when autoRefresh is disabled", async () => {
      vi.useFakeTimers();
      const futureExpiration = new Date(
        Date.now() + dayjs.duration(10, "minutes").asMilliseconds()
      ).toISOString();
      const cachedData = {
        data: mockSuccessResponse,
        metadata: {
          expiration: futureExpiration,
        },
      };

      getCacheEntryMock.mockResolvedValue(cachedData as CacheRecord_db_type);

      await getSourceDateDataType({
        source: "ISS",
        dateWanted: "2025-01-01",
        dataFetchConfig: mockDataFetchConfig,
        autoRefresh: false,
      });

      // Check that no timeout was scheduled
      const tracker = globalValues.fetchTrackers?.["ISS"]?.["2025-01-01"]?.["videos"];
      expect(tracker?.timeoutObject).toBeUndefined();
    });

    it("uses different timeout delays for today vs historical dates", async () => {
      vi.useFakeTimers();
      const mockNow = new Date();
      vi.setSystemTime(mockNow);

      const today = mockNow.toISOString().split("T")[0];
      const historical = "2020-01-01";
      const expiredCache = {
        data: mockSuccessResponse,
        metadata: { expiration: new Date(Date.now() - 10000).toISOString() },
      };

      getCacheEntryMock.mockResolvedValue(expiredCache as CacheRecord_db_type);
      (mockDataFetchConfig.getDataFunction as Mock).mockResolvedValue(mockSuccessResponse);

      await getSourceDateDataType({
        source: "ISS",
        dateWanted: today,
        dataFetchConfig: mockDataFetchConfig,
        autoRefresh: true,
      });

      await vi.advanceTimersByTimeAsync(0);
      const todayDelay = globalValues.fetchTrackers?.["ISS"]?.[today]?.["videos"]?.timeoutDelayMs;

      await getSourceDateDataType({
        source: "ISS",
        dateWanted: historical,
        dataFetchConfig: mockDataFetchConfig,
        autoRefresh: true,
      });

      await vi.advanceTimersByTimeAsync(0);
      const historicalDelay =
        globalValues.fetchTrackers?.["ISS"]?.[historical]?.["videos"]?.timeoutDelayMs;

      // Today should have significantly shorter delay than historical
      expect(todayDelay).toBeDefined();
      expect(historicalDelay).toBeDefined();
      expect(todayDelay).toBeLessThan(historicalDelay! * 0.5); // Today should be <50% of historical
    });

    it("handles long-running fetch taking longer than 30s timeout correctly", async () => {
      vi.useFakeTimers();
      getCacheEntryMock.mockResolvedValue(null);

      // Simulate a fetch that takes longer than timeout
      (mockDataFetchConfig.getDataFunction as Mock).mockImplementation(
        () =>
          new Promise(
            (resolve) =>
              setTimeout(
                () => resolve(mockSuccessResponse),
                dayjs.duration(60, "seconds").asMilliseconds()
              ) // 60s delay
          )
      );

      const result = await getSourceDateDataType({
        source: "ISS",
        dateWanted: "2025-01-01",
        dataFetchConfig: mockDataFetchConfig,
        autoRefresh: true,
      });

      expect(result).toBeNull();

      // Advance past fetch timeout (30s) to trigger timeout in background fetch
      await vi.advanceTimersByTimeAsync(30100);
      await Promise.resolve();

      // Check that fetch tracker shows timeout error
      const tracker = globalValues.fetchTrackers?.["ISS"]?.["2025-01-01"]?.["videos"];
      expect(tracker?.lastOperationSuccess).toBe(false);
      expect(tracker?.lastErrorMessage).toContain("Timeout after 30000ms");

      // Clean up any remaining timers (the 60s setTimeout that was never resolved)
      await vi.runOnlyPendingTimersAsync();
    });
  });

  describe("forceRefreshDataType", () => {
    it("expires cache and triggers immediate fetch", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-11-13T12:00:00Z"));

      getCacheEntryMock
        .mockResolvedValueOnce({
          data: { videos: [] },
          metadata: {
            expiration: new Date(
              Date.now() + dayjs.duration(10, "minutes").asMilliseconds()
            ).toISOString(),
          },
        } as CacheRecord_db_type)
        .mockResolvedValueOnce({
          data: { videos: [] },
          metadata: { expiration: new Date(Date.now() - 10000).toISOString() },
        } as CacheRecord_db_type);

      getVideoDataMock.mockResolvedValue({
        data: [],
        fetchMetadata: { success: true, timestamp: new Date().toISOString() },
      });

      const result = await forceRefreshDataType({
        source: "ISS",
        dateWanted: "2025-01-01",
        dataType: "videos",
      });

      await vi.advanceTimersByTimeAsync(0);

      expect(result.success).toBe(true);
      expect(getVideoDataMock).toHaveBeenCalled();
    });

    it("returns error for invalid data type", async () => {
      const result = await forceRefreshDataType({
        source: "ISS",
        dateWanted: "2025-01-01",
        dataType: "invalidType" as StoreDataType,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not available for source");
    });
  });

  describe("Fetch Tracker Management", () => {
    it("initializes fetch tracker entry on first access", async () => {
      const mockConfig: FetchConfig = {
        type: "photos",
        getDataFunction: vi.fn().mockResolvedValue({
          data: null,
          fetchMetadata: { success: true, timestamp: new Date().toISOString() },
        }),
        fetchTimeoutMs: dayjs.duration(30, "seconds").asMilliseconds(),
        refreshIntervalMs: dayjs.duration(60, "minutes").asMilliseconds(),
        refreshIntervalTodayMs: dayjs.duration(2, "minutes").asMilliseconds(),
        enableCacheUse: true,
      };

      getCacheEntryMock.mockResolvedValue(null);

      await getSourceDateDataType({
        source: "ISS",
        dateWanted: "2025-01-01",
        dataFetchConfig: mockConfig,
        autoRefresh: false,
      });

      const tracker = globalValues.fetchTrackers?.["ISS"]?.["2025-01-01"]?.["photos"];
      expect(tracker).toBeDefined();
      expect(tracker?.isFetching).toBe(false);
    });
  });
});
