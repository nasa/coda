type FetchStatus = "inprogress" | "complete" | "error";

/** New simplified metadata for fetch results - no caching concerns */
interface FetchMetadata {
  success: boolean;
  error?: string;
  timestamp: string;
  /** Indicates this data type is not applicable for the current source */
  unneeded?: boolean;
}

/** New simplified response type focused on fetch success/failure - no caching concerns */
interface FetchResponse<T> {
  data: T;
  fetchMetadata: FetchMetadata;
  origin?: string; // where the data came from
}

type CacheMetadata = {
  expiration: string;
};

type CacheRecord = {
  id: number;
  folder: string;
  cacheKey: string;
  data: unknown;
  metadata: CacheMetadata;
  createdAt: Date;
  lastAccessedAt: Date;
};

/** Per-source aggregation returned by getCacheStats(). */
interface CacheSourceStat {
  source: string;
  count: number;
  totalBytes: number;
  oldestAccess: string | null;
  newestAccess: string | null;
}

/** Per-data-type (cacheKey) aggregation returned by getCacheStats(). */
interface CacheTypeStat {
  cacheKey: string;
  count: number;
  totalBytes: number;
}

/** Per-month aggregation returned by getCacheStats(). Empty month === the "allDates" bucket. */
interface CacheMonthStat {
  month: string;
  count: number;
  totalBytes: number;
}

/** Full cache report returned by GET /api/v1/db/cache/stats. */
interface CacheStats {
  totals: { count: number; totalBytes: number };
  bySource: CacheSourceStat[];
  byType: CacheTypeStat[];
  byMonth: CacheMonthStat[];
}

/** Criteria accepted by purgeCacheEntries() / POST /api/v1/db/cache/purge. */
interface CachePurgeParams {
  source?: string;
  cacheKey?: string;
  /** Date prefix (YYYY-MM) matched against the folder's date segment. */
  month?: string;
  olderThanDays?: number;
  dryRun?: boolean;
}
