import express, { Request, Response } from "express";
import { getCacheStats, purgeCacheEntries } from "server/express/cache-db";
import { requireSuperuser } from "server/express/middleware/requireSuperuser";
import ConsoleLogger from "utils/logging/consoleLogger";

/**
 * Superuser-only admin routes for reporting on and cleaning up the cache_db table.
 * Both reads and writes are guarded — the report exposes cache internals and the
 * purge action is destructive.
 */
const router = express.Router();

// Cache size and entry-count report, broken down by source, data type, and date.
router.get("/stats", requireSuperuser, async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json(await getCacheStats());
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error fetching cache stats ${e}` });
  }
});

// Purge (or preview via dryRun) cache entries by source, data type, and/or inactivity age.
router.post("/purge", requireSuperuser, async (req: Request, res: Response): Promise<void> => {
  const { source, cacheKey, month, olderThanDays, dryRun } = req.body as CachePurgeParams;

  // Require at least one filter criterion to prevent an accidental full-table wipe.
  if (!source && !cacheKey && !month && (typeof olderThanDays !== "number" || olderThanDays < 0)) {
    res.status(400).json({
      status: "error",
      message: "At least one of source, cacheKey, month, or olderThanDays is required",
    });
    return;
  }

  try {
    const count = await purgeCacheEntries({ source, cacheKey, month, olderThanDays, dryRun });
    res.json({ status: "success", count });
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error purging cache entries ${e}` });
  }
});

export default router;
