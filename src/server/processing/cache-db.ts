import { getEM } from "../../utils/mikro";
import { Cache_db } from "../database/models/cache.model";

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
  const em = getEM().fork();
  try {
    const entry = await em.findOne(Cache_db, { folder, cacheKey: identifier });
    if (entry) {
      entry.lastAccessedAt = new Date();
      await em.flush(); // Persist the change to lastAccessedAt
    }
    return entry;
  } catch (error) {
    console.error(`Error getting cache entry for ${folder}/${identifier}:`, error);
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
  data: Object | null;
  metadata: CacheMetadata | SocketCacheMetadata;
}): Promise<Cache_db | null> {
  const em = getEM().fork();
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
    await em.persistAndFlush(entry);
    return entry;
  } catch (error) {
    console.error(`Error putting cache entry for ${folder}/${identifier}:`, error);
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
  const em = getEM().fork();
  try {
    if (identifier) {
      // If identifier is provided, remove a specific entry
      const entry = await em.findOne(Cache_db, { folder, cacheKey: identifier });
      if (entry) {
        await em.removeAndFlush(entry);
        return true;
      }
      return false; // Entry not found
    } else {
      // If identifier is not provided, remove all entries for the given folder
      const numDeleted = await em.nativeDelete(Cache_db, { folder });
      return numDeleted > 0;
    }
  } catch (error) {
    console.error(`Error removing cache entry for ${folder}/${identifier ?? "all"}:`, error);
    return false;
  }
}

/**
 * Removes Least Recently Used (LRU) entries from a specific folder that were last accessed before a given date.
 * @param folder The cache folder to clean up.
 * @param olderThanDate Entries last accessed before this date will be removed.
 * @returns The number of entries removed.
 */
export async function evictLruCacheEntries({
  olderThanDate,
  folder,
}: {
  olderThanDate: Date;
  folder?: string;
}): Promise<number> {
  const em = getEM().fork();
  try {
    const filter: any = {
      lastAccessedAt: { $lt: olderThanDate },
    };
    if (folder) {
      filter.folder = folder;
    }
    const numDeleted = await em.nativeDelete(Cache_db, filter);
    return numDeleted;
  } catch (error) {
    console.error(
      `Error removing LRU entries ${folder ? `for folder ${folder} ` : ""}older than ${olderThanDate.toISOString()}:`,
      error
    );
    return 0;
  }
}
