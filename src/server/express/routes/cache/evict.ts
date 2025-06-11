import { evictLruCacheEntries } from "server/processing/cache-db";
import express, { Request, Response } from "express";
import { onlyEmssSuperuser } from "../user/auth";

/**
 * `/api/cache/evict`
 *
 * Evicts cache entries not read since a given date, optionally filtered by folder.
 * Query parameters:
 * - lastUsedDate (required): ISO date string. Entries last accessed before this date will be removed.
 * - folder (optional): The cache folder to clean up. If not provided, applies to all folders.
 */
const router = express.Router();

router.get(
  "/",
  async (req: Request<{}, {}, {}, EvictCacheQueryParams>, res: Response): Promise<void> => {
    if (!onlyEmssSuperuser(req)) {
      res.status(403).json({ success: false, error: "Forbidden" });
      return;
    }
    const { lastUsedIsoDate, folder } = req.query;

    if (!lastUsedIsoDate) {
      res
        .status(400)
        .json({ success: false, error: "lastUsedIsoDate query parameter is required" });
      return;
    }

    const olderThanDate = new Date(lastUsedIsoDate);
    if (isNaN(olderThanDate.getTime())) {
      res.status(400).json({
        success: false,
        error: "Invalid lastUsedIsoDate format. Please use ISO date string.",
      });
      return;
    }

    try {
      const count = await evictLruCacheEntries({ olderThanDate, folder });
      res.status(200).json({ success: true, message: `Evicted ${count} entries.` });
    } catch (e: any) {
      console.error("Error during cache eviction:", e);
      res.status(500).json({ success: false, error: e.toString() });
    }
  }
);

export default router;
