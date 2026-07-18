import type { FilterQuery } from "@mikro-orm/core";
import { getORM } from "server/express/global";
import { Cache_db } from "../database/models/cache.model";
import ConsoleLogger from "utils/logging/consoleLogger";

/**
 * Retrieves a cache entry from the database and updates its lastAccessedAt timestamp.
 */
export async function getCacheEntry({
  folder,
  identifier,
}: {
  folder: string;
  identifier: string;
}): Promise<Cache_db | null> {
  const em = getORM().em.fork();
  try {
    const entry = await em.findOne(Cache_db, { folder, cacheKey: identifier });
    if (entry) {
      entry.lastAccessedAt = new Date();
      await em.flush(); // Persist the change to lastAccessedAt
      return entry;
    } else {
      ConsoleLogger.debug(`Cache miss for ${folder}/${identifier}`);
      return null;
    }
  } catch (error) {
    ConsoleLogger.error(`Error getting cache entry for ${folder}/${identifier}:`, error);
    return null;
  }
}

/**
 * Inserts or updates a cache entry in the database.
 * If an entry exists, its createdAt and lastAccessedAt are updated.
 * If it's a new entry, createdAt and lastAccessedAt are set.
 */

export async function putCacheEntry({
  folder,
  identifier,
  data,
  metadata,
}: {
  folder: string;
  identifier: string;
  data: object | null;
  metadata: CacheMetadata;
}): Promise<Cache_db | null> {
  const em = getORM().em.fork();
  try {
    let entry = await em.findOne(Cache_db, { folder, cacheKey: identifier });
    const now = new Date();
    if (entry) {
      // Update existing entry
      entry.data = data;
      entry.metadata = metadata;
      entry.createdAt = now; // Update createdAt as per request
      entry.lastAccessedAt = now;
    } else {
      // Create new entry
      entry = em.create(Cache_db, {
        folder,
        cacheKey: identifier,
        data,
        metadata,
        createdAt: now,
        lastAccessedAt: now,
      });
    }
    await em.persist(entry).flush();
    return entry;
  } catch (error) {
    ConsoleLogger.error(`Error putting cache entry for ${folder}/${identifier}:`, error);
    return null;
  }
}

/**
 * Removes a specific cache entry from the database.
 */
export async function removeCacheEntry({
  folder,
  identifier,
}: {
  folder: string;
  identifier?: string;
}): Promise<boolean> {
  const em = getORM().em.fork();
  try {
    if (identifier) {
      // If identifier is provided, remove a specific entry
      const entry = await em.findOne(Cache_db, { folder, cacheKey: identifier });
      if (entry) {
        await em.remove(entry).flush();
        return true;
      }
      return false; // Entry not found
    } else {
      // If identifier is not provided, remove all entries for the given folder
      const numDeleted = await em.nativeDelete(Cache_db, { folder });
      return numDeleted > 0;
    }
  } catch (error) {
    ConsoleLogger.error(`Error removing cache entry for ${folder}/${identifier ?? "all"}:`, error);
    return false;
  }
}

/**
 * The special cache folder used for source-independent data (see dataRetrievalScheduler).
 * Its `folder` is exactly `socketDataCache/allDates` rather than the usual
 * `socketDataCache/${source}/${date}` shape.
 */
const ALL_DATES_FOLDER = "socketDataCache/allDates";

/**
 * Rows come back from raw SQL aggregation with numeric columns as strings
 * (Postgres COUNT/SUM) — this normalises the shape node-postgres returns.
 */
function unwrapRows<T>(result: unknown): T[] {
  return (result as { rows?: T[] }).rows ?? (result as T[]);
}

/**
 * Aggregate reporting over the whole cache_db table. Size is not stored, so it is
 * computed on the fly. We use octet_length(data::text) — the byte length of the
 * JSON representation — rather than pg_column_size(data), which reports the much
 * smaller TOAST-compressed on-disk size and so wildly understates the logical
 * data size (and doesn't line up with an uncompressed SQL dump). Mirrors the
 * raw-SQL aggregation approach used by the ephemeris getStats().
 */
export async function getCacheStats(): Promise<CacheStats> {
  const em = getORM().em.fork();
  const connection = em.getConnection();

  const totalsRows = unwrapRows<{ count: string; total_bytes: string }>(
    await connection.execute(
      `SELECT COUNT(*) AS count, COALESCE(SUM(octet_length(data::text)), 0) AS total_bytes
       FROM cache_db`
    )
  );

  const bySourceRows = unwrapRows<{
    source: string;
    count: string;
    total_bytes: string;
    oldest_access: Date | string | null;
    newest_access: Date | string | null;
  }>(
    await connection.execute(
      `SELECT split_part(folder, '/', 2) AS source,
              COUNT(*) AS count,
              COALESCE(SUM(octet_length(data::text)), 0) AS total_bytes,
              MIN(last_accessed_at) AS oldest_access,
              MAX(last_accessed_at) AS newest_access
       FROM cache_db
       GROUP BY split_part(folder, '/', 2)
       ORDER BY total_bytes DESC`
    )
  );

  const byTypeRows = unwrapRows<{ cache_key: string; count: string; total_bytes: string }>(
    await connection.execute(
      `SELECT cache_key,
              COUNT(*) AS count,
              COALESCE(SUM(octet_length(data::text)), 0) AS total_bytes
       FROM cache_db
       GROUP BY cache_key
       ORDER BY total_bytes DESC`
    )
  );

  // Group dates by month (YYYY-MM). The date is the 3rd path segment of the
  // folder; the allDates bucket has no date segment (empty string) and falls
  // into its own "" group, labelled "(all dates)" on the client.
  const byMonthRows = unwrapRows<{ month: string; count: string; total_bytes: string }>(
    await connection.execute(
      `SELECT substring(split_part(folder, '/', 3) FROM 1 FOR 7) AS month,
              COUNT(*) AS count,
              COALESCE(SUM(octet_length(data::text)), 0) AS total_bytes
       FROM cache_db
       GROUP BY substring(split_part(folder, '/', 3) FROM 1 FOR 7)
       ORDER BY month DESC`
    )
  );

  const toIso = (value: Date | string | null): string | null => {
    if (!value) return null;
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  };

  return {
    totals: {
      count: parseInt(totalsRows[0]?.count ?? "0", 10),
      totalBytes: parseInt(totalsRows[0]?.total_bytes ?? "0", 10),
    },
    bySource: bySourceRows.map((r) => ({
      source: r.source,
      count: parseInt(r.count, 10),
      totalBytes: parseInt(r.total_bytes, 10),
      oldestAccess: toIso(r.oldest_access),
      newestAccess: toIso(r.newest_access),
    })),
    byType: byTypeRows.map((r) => ({
      cacheKey: r.cache_key,
      count: parseInt(r.count, 10),
      totalBytes: parseInt(r.total_bytes, 10),
    })),
    byMonth: byMonthRows.map((r) => ({
      month: r.month,
      count: parseInt(r.count, 10),
      totalBytes: parseInt(r.total_bytes, 10),
    })),
  };
}

/**
 * Builds the MikroORM filter for a purge request from the supplied criteria.
 * Returns null when no criteria are supplied, so callers can reject an empty
 * filter and avoid an accidental full-table wipe.
 */
function buildPurgeFilter({
  source,
  cacheKey,
  month,
  olderThanDays,
}: CachePurgeParams): FilterQuery<Cache_db> | null {
  const filter: FilterQuery<Cache_db> = {};
  let hasCriteria = false;

  if (typeof olderThanDays === "number" && olderThanDays >= 0) {
    const cutoff = new Date(Date.now() - olderThanDays * 86400000);
    filter.lastAccessedAt = { $lt: cutoff };
    hasCriteria = true;
  }

  // Folder encodes both source and date: socketDataCache/${source}/${date}, with
  // the special exact folder socketDataCache/allDates for source-independent data.
  // Source and/or month (YYYY-MM date prefix) both constrain that folder path.
  if (source || month) {
    if (source === "allDates") {
      filter.folder = ALL_DATES_FOLDER;
    } else if (source && month) {
      filter.folder = { $like: `socketDataCache/${source}/${month}%` };
    } else if (source) {
      filter.folder = { $like: `socketDataCache/${source}/%` };
    } else {
      // Month across all sources: source segment is the wildcard.
      filter.folder = { $like: `socketDataCache/%/${month}%` };
    }
    hasCriteria = true;
  }

  if (cacheKey) {
    filter.cacheKey = cacheKey;
    hasCriteria = true;
  }

  return hasCriteria ? filter : null;
}

/**
 * Manually purge cache entries matching any combination of source, data type
 * (cacheKey), and inactivity age. When dryRun is true, returns the count of
 * entries that would be deleted without deleting them. Rejects an empty filter
 * to prevent accidentally wiping the whole table.
 * @returns The number of entries deleted (or that would be deleted for a dry run).
 */
export async function purgeCacheEntries(params: CachePurgeParams): Promise<number> {
  const filter = buildPurgeFilter(params);
  if (!filter) {
    throw new Error(
      "purgeCacheEntries requires at least one of: source, cacheKey, month, olderThanDays"
    );
  }

  const em = getORM().em.fork();
  if (params.dryRun) {
    return em.count(Cache_db, filter);
  }
  return em.nativeDelete(Cache_db, filter);
}
