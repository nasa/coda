import { vi } from "vitest";
import type { Mock } from "vitest";
import { getCacheStats, purgeCacheEntries } from "./cache-db";
import { getORM } from "server/express/global";
import { Cache_db } from "server/database/models/cache.model";

vi.mock("server/express/global");

// A minimal fork()'d EntityManager stub. Each test wires up the methods it needs.
const executeMock = vi.fn();
const countMock = vi.fn();
const nativeDeleteMock = vi.fn();

const forkMock = vi.fn(() => ({
  count: countMock,
  nativeDelete: nativeDeleteMock,
  getConnection: () => ({ execute: executeMock }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  (getORM as Mock).mockReturnValue({ em: { fork: forkMock } });
});

describe("purgeCacheEntries", () => {
  it("rejects an empty filter to prevent a full-table wipe", async () => {
    await expect(purgeCacheEntries({})).rejects.toThrow(/at least one/i);
    expect(countMock).not.toHaveBeenCalled();
    expect(nativeDeleteMock).not.toHaveBeenCalled();
  });

  it("builds a $like folder filter for a per-source purge (dry run counts only)", async () => {
    countMock.mockResolvedValue(7);

    const count = await purgeCacheEntries({ source: "ISS", dryRun: true });

    expect(count).toBe(7);
    expect(nativeDeleteMock).not.toHaveBeenCalled();
    expect(countMock).toHaveBeenCalledWith(Cache_db, {
      folder: { $like: "socketDataCache/ISS/%" },
    });
  });

  it("builds a wildcard-source folder filter for a month purge", async () => {
    countMock.mockResolvedValue(5);

    await purgeCacheEntries({ month: "2025-01", dryRun: true });

    expect(countMock).toHaveBeenCalledWith(Cache_db, {
      folder: { $like: "socketDataCache/%/2025-01%" },
    });
  });

  it("scopes the folder to both source and month when both are supplied", async () => {
    countMock.mockResolvedValue(2);

    await purgeCacheEntries({ source: "ISS", month: "2025-01", dryRun: true });

    expect(countMock).toHaveBeenCalledWith(Cache_db, {
      folder: { $like: "socketDataCache/ISS/2025-01%" },
    });
  });

  it("matches the exact folder for the allDates bucket", async () => {
    countMock.mockResolvedValue(1);

    await purgeCacheEntries({ source: "allDates", dryRun: true });

    expect(countMock).toHaveBeenCalledWith(Cache_db, {
      folder: "socketDataCache/allDates",
    });
  });

  it("builds a lastAccessedAt cutoff for olderThanDays and deletes when not a dry run", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-31T00:00:00.000Z"));
    nativeDeleteMock.mockResolvedValue(42);

    const count = await purgeCacheEntries({ cacheKey: "videos", olderThanDays: 30 });

    expect(count).toBe(42);
    expect(countMock).not.toHaveBeenCalled();
    expect(nativeDeleteMock).toHaveBeenCalledWith(Cache_db, {
      cacheKey: "videos",
      lastAccessedAt: { $lt: new Date("2026-01-01T00:00:00.000Z") },
    });

    vi.useRealTimers();
  });
});

describe("getCacheStats", () => {
  it("parses string aggregates into numbers and normalises timestamps", async () => {
    executeMock
      .mockResolvedValueOnce({ rows: [{ count: "3", total_bytes: "3072" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            source: "ISS",
            count: "2",
            total_bytes: "2048",
            oldest_access: new Date("2026-01-01T00:00:00.000Z"),
            newest_access: new Date("2026-01-10T00:00:00.000Z"),
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ cache_key: "videos", count: "3", total_bytes: "3072" }] })
      .mockResolvedValueOnce({ rows: [{ month: "2026-01", count: "3", total_bytes: "3072" }] });

    const stats = await getCacheStats();

    expect(stats.totals).toEqual({ count: 3, totalBytes: 3072 });
    expect(stats.bySource).toEqual([
      {
        source: "ISS",
        count: 2,
        totalBytes: 2048,
        oldestAccess: "2026-01-01T00:00:00.000Z",
        newestAccess: "2026-01-10T00:00:00.000Z",
      },
    ]);
    expect(stats.byType).toEqual([{ cacheKey: "videos", count: 3, totalBytes: 3072 }]);
    expect(stats.byMonth).toEqual([{ month: "2026-01", count: 3, totalBytes: 3072 }]);
  });
});
