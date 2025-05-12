import express, { Request, Response } from "express";
import cacache from "cacache"; // This import seems unused in the new logic, consider removing if not needed elsewhere.
import path from "path";
import fs from "fs"; // Added fs import
import { ConsoleLogger } from "../../../../utils/logger";

// Create a router object
const router = express.Router();

router.get("/", async (req: Request, res: Response): Promise<void> => {
  const cacheRootPath = process.env.CACHE_ROOT;

  // Set content type to plain text for streaming
  res.setHeader("Content-Type", "text/plain");

  // Helper function to write to response stream
  const writeToStream = (message: string) => {
    res.write(message);
  };

  if (!cacheRootPath) {
    const errorMsg = "CACHE_ROOT environment variable is not set.";
    ConsoleLogger.error(errorMsg);
    writeToStream(`ERROR: ${errorMsg}\n`);
    res.end();
    return;
  }

  const resolvedCachePath = path.resolve(cacheRootPath); // Ensure it's an absolute path

  try {
    const startMsg = `Starting garbage collect scan for cache root: ${resolvedCachePath}`;
    ConsoleLogger.log(startMsg);
    writeToStream(`${startMsg}\n`);

    const cacheDirs = await findLowestLevelCacheDirs(resolvedCachePath);
    const folderNames = cacheDirs.map((dir) => {
      return dir.replace(resolvedCachePath, "").replace(/\\/g, "/").replace(/^\//, "");
    });

    writeToStream(`Found ${cacheDirs.length} lowest-level cache directories.\n`);
    writeToStream(`Cache directories: ${folderNames.join(", \n")}\n\n`);

    ConsoleLogger.log(`Found ${cacheDirs.length} lowest-level cache directories.`);
    ConsoleLogger.log("Cache directories:", folderNames);

    // Perform garbage collection on the found directories
    const verifyStats = await garbageCollectByFolders(folderNames, writeToStream);

    // Calculate and display totals from all folders
    const totals = {
      compacted: 0,
      totalEntries: 0,
      removedEmptyFolders: 0,
      reclaimedCount: 0,
      reclaimedSize: 0,
      badContentCount: 0,
      keptSize: 0,
      totalRunTime: 0,
    };

    // Aggregate statistics from all directories
    Object.keys(verifyStats).forEach((folder) => {
      const stats = verifyStats[folder];

      // Compaction totals
      if (stats.compaction) {
        totals.compacted += stats.compaction.compacted || 0;
        totals.totalEntries += stats.compaction.total || 0;
      }

      // Empty folders removed
      if (stats.emptyFolders) {
        totals.removedEmptyFolders += stats.emptyFolders.removed || 0;
      }

      // Verification totals based on the actual structure
      if (stats.verification) {
        // Add reclaimed content stats
        totals.reclaimedCount += stats.verification.reclaimedCount || 0;
        totals.reclaimedSize += stats.verification.reclaimedSize || 0;

        // Add bad content stats
        totals.badContentCount += stats.verification.badContentCount || 0;

        // Add kept content size
        totals.keptSize += stats.verification.keptSize || 0;

        // Add total runtime
        if (stats.verification.runTime && stats.verification.runTime.total) {
          totals.totalRunTime += stats.verification.runTime.total;
        }

        // Ensure we count the entries from verification if available
        if (stats.verification.totalEntries && !stats.compaction) {
          totals.totalEntries += stats.verification.totalEntries;
        }
      }
    });

    writeToStream("\nGarbage collection completed.\n");

    // Display the total statistics with more detailed information
    writeToStream("\nOVERALL TOTALS:\n");
    writeToStream(`Total cache entries processed: ${totals.totalEntries}\n`);
    writeToStream(`Total entries compacted: ${totals.compacted}\n`);
    writeToStream(`Total reclaimed entries: ${totals.reclaimedCount}\n`);
    writeToStream(`Total reclaimed size: ${formatSize(totals.reclaimedSize)}\n`);
    writeToStream(`Total bad content entries: ${totals.badContentCount}\n`);
    writeToStream(`Total kept size: ${formatSize(totals.keptSize)}\n`);
    writeToStream(`Total empty folders removed: ${totals.removedEmptyFolders}\n`);
    writeToStream(`Total verification runtime: ${totals.totalRunTime}ms\n`);

    writeToStream("Summary by directory:\n");
    writeToStream(JSON.stringify(verifyStats, null, 2) + "\n");
    res.end();
  } catch (error) {
    const errorMsg = `Failed to list cache directories during garbage collection scan: ${(error as Error).message}`;
    ConsoleLogger.error(errorMsg);
    writeToStream(`ERROR: ${errorMsg}\n`);
    res.end();
  }
});

// Helper function to make a list of cachePath values by recursively finding lowest level directories in the cacache store.
// Do this by looking for the folder called "content-v2"
async function findLowestLevelCacheDirs(currentPath: string): Promise<string[]> {
  let resultPaths: string[] = [];
  try {
    const dirents = await fs.promises.readdir(currentPath, { withFileTypes: true });

    const subDirectoryNames = dirents
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    if (subDirectoryNames.includes("content-v2")) {
      // currentPath is a "lowest level folder we want" because it directly contains "content-v2"
      resultPaths.push(currentPath);
      // Do not recurse further down this path as we've found the target indicator.
    } else {
      // currentPath does not directly contain "content-v2".
      // Recurse into its subdirectories.
      for (const dirent of dirents) {
        // Only recurse into actual directories, and avoid recursing into a directory named 'content-v2' itself
        // (though the above check `subDirectoryNames.includes("content-v2")` handles the primary case for 'content-v2').
        if (dirent.isDirectory()) {
          const subDirPath = path.join(currentPath, dirent.name);
          const nestedPaths = await findLowestLevelCacheDirs(subDirPath);
          resultPaths = resultPaths.concat(nestedPaths);
        }
      }
    }
  } catch (err) {
    // Log errors like permission denied or if currentPath is not a directory, then continue
    ConsoleLogger.warn(`Error processing directory ${currentPath}: ${(err as Error).message}`);
  }
  return resultPaths;
}

/**
 * Recursively removes empty folders in a directory
 * @param dirPath - The directory path to start from
 * @returns An object containing the number of removed folders and any errors encountered
 */
async function removeEmptyFolders(
  dirPath: string,
  writeStream?: (message: string) => void
): Promise<{ removedCount: number; errors: string[] }> {
  const result = { removedCount: 0, errors: [] as string[] };

  try {
    // Check if path exists before trying to read it
    const exists = await fs.promises
      .access(dirPath)
      .then(() => true)
      .catch(() => false);
    if (!exists) {
      return result;
    }

    const dirents = await fs.promises.readdir(dirPath, { withFileTypes: true });

    // Process subdirectories first
    for (const dirent of dirents) {
      if (dirent.isDirectory()) {
        const subDirPath = path.join(dirPath, dirent.name);
        // Recursively process subdirectory
        const subResult = await removeEmptyFolders(subDirPath, writeStream);
        result.removedCount += subResult.removedCount;
        result.errors = result.errors.concat(subResult.errors);
      }
    }
    // After processing subdirectories, check if current directory is empty
    const currentDirents = await fs.promises.readdir(dirPath);
    if (currentDirents.length === 0) {
      // Remove empty directory
      await fs.promises.rmdir(dirPath);
      result.removedCount++;
    }
  } catch (error) {
    // Add any errors to the result but continue processing
    const errorMessage = `Error processing ${dirPath}: ${(error as Error).message}`;
    result.errors.push(errorMessage);
    ConsoleLogger.warn(
      `Error while removing empty folders in ${dirPath}: ${(error as Error).message}`
    );
    if (writeStream) writeStream(`WARNING: ${errorMessage}\n`);
  }

  return result;
}

interface CacheGarbageCollectVerifyStats {
  [key: string]: any;
}
async function garbageCollectByFolders(
  folders: string[],
  writeStream?: (message: string) => void
): Promise<CacheGarbageCollectVerifyStats> {
  const verifyStats: CacheGarbageCollectVerifyStats = {};
  for (const folder of folders) {
    try {
      // Write initial status message
      if (writeStream) writeStream(`Starting garbage collection for folder: ${folder}\n`);

      // Construct the full path to the specific cache directory
      const cacheSubDirPath = path.join(process.env.CACHE_ROOT, folder);
      // perform an ls on the cache directory to verify that it is a valid cache directory
      const lsStats = await cacache.ls(cacheSubDirPath);
      if (!lsStats) {
        const message = `No cache entries found for folder: ${folder}`;
        ConsoleLogger.error(message);
        if (writeStream) writeStream(`ERROR: ${message}\n`);
        continue;
      }

      // Run verification to clean up any unreferenced content
      if (writeStream) writeStream(`Verifying cache integrity for folder: ${folder}...\n`);
      const verifyResult = await cacache.verify(cacheSubDirPath);
      if (writeStream) writeStream(`Verification complete for folder: ${folder}\n`);

      // Compact the cache to remove unreferenced indexes
      const compactMessage = `Starting compaction for cache folder: ${folder}`;
      ConsoleLogger.log(compactMessage);
      if (writeStream) writeStream(`${compactMessage}\n`);

      let compactionStats = { compacted: 0, total: 0 };

      // Get all keys from the cache
      const keys = Object.keys(lsStats);
      compactionStats.total = keys.length;

      if (writeStream) writeStream(`Found ${keys.length} cache entries to process\n`);

      // Process each key for compaction
      for (const key of keys) {
        try {
          // Match function to determine which entries to keep (true = keep, false = remove)
          // This function keeps all entries (can be customized based on needs)
          const matchFn = (entry: any) => {
            // Keep entries that have valid integrity and metadata
            return entry && entry.integrity;
          };

          // @ts-expect-error because the cacache types are out of date
          await cacache.index.compact(cacheSubDirPath, key, matchFn);
          compactionStats.compacted++;

          // Every 100 entries, provide a progress update
          if (compactionStats.compacted % 100 === 0 && writeStream) {
            writeStream(
              `Progress: Compacted ${compactionStats.compacted}/${compactionStats.total} entries\n`
            );
          }
        } catch (compactError) {
          const errorMsg = `Error compacting key ${key} in folder ${folder}: ${(compactError as Error).message}`;
          ConsoleLogger.warn(errorMsg);
          if (writeStream) writeStream(`WARNING: ${errorMsg}\n`);
        }
      }

      // Now run the empty folder cleanup. This doesn't use the cacache API since it doesn't have this kind of functionality
      const cleanupMsg = `Cleaning up empty folders in: ${cacheSubDirPath}`;
      ConsoleLogger.log(cleanupMsg);
      if (writeStream) writeStream(`${cleanupMsg}\n`);

      const emptyFolderResult = await removeEmptyFolders(cacheSubDirPath, writeStream);

      // Combine compaction and verification stats
      verifyStats[folder] = {
        compaction: compactionStats,
        verification: verifyResult,
        emptyFolders: {
          removed: emptyFolderResult.removedCount,
          errors: emptyFolderResult.errors,
        },
      };

      const summaryMsg = [
        `Garbage collection completed for folder: ${folder}`,
        `Compacted ${compactionStats.compacted}/${compactionStats.total} entries`,
        `Removed ${emptyFolderResult.removedCount} empty folders`,
      ];

      for (const msg of summaryMsg) {
        ConsoleLogger.log(msg);
        if (writeStream) writeStream(`${msg}\n`);
      }
    } catch (error) {
      const errorMsg = `Error during garbage collection for folder ${folder}: ${(error as Error).message}`;
      ConsoleLogger.error(errorMsg);
      if (writeStream) writeStream(`ERROR: ${errorMsg}\n`);
    }
  }
  return verifyStats;
}

/**
 * Format byte size to human-readable format
 * @param bytes - Size in bytes
 * @returns Formatted string with appropriate unit
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default router;
