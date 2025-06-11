import express, { Request, Response } from "express";
import crypto from "crypto";
import cacache from "cacache";
import { putCacheEntry } from "../../../processing/cache-db";
import { onlyEmssSuperuser } from "../user/auth";

// Define the expected query parameters interface
interface PortCacheQueryParams {
  folder?: string;
  key?: string;
}

const router = express.Router();

router.get(
  "/",
  async (req: Request<{}, {}, {}, PortCacheQueryParams>, res: Response): Promise<void> => {
    if (!onlyEmssSuperuser(req)) {
      res.status(403).json({ success: false, error: "Forbidden" });
      return;
    }
    const { folder, key } = req.query;

    if (!folder || !key) {
      res
        .status(400)
        .json({ success: false, error: "folder and key query parameters are required" });
      return;
    }

    if (!process.env.CACHE_ROOT) {
      console.error("CACHE_ROOT environment variable is not set for old cache system.");
      res
        .status(500)
        .json({ success: false, error: "Server configuration error: CACHE_ROOT not set." });
      return;
    }
    const oldCachePath = `${process.env.CACHE_ROOT}/${folder}`;
    const hashedKey = crypto.createHash("md5").update(key).digest("hex");

    try {
      // 1. Get from old cacache, including metadata
      const { data: oldDataBuffer, metadata: oldCacacheMetadata } = await cacache.get(
        oldCachePath,
        hashedKey
      );

      let parsedData: any;
      try {
        // Attempt to parse as JSON
        parsedData = JSON.parse(oldDataBuffer.toString("utf8"));
      } catch (parseError: any) {
        // If JSON.parse fails, return an error
        const errorMessage = `Failed to parse cache data as JSON for ${folder}/${key} (hashed: ${hashedKey}). Error: ${parseError.message}`;
        console.error(errorMessage);
        res.status(422).json({
          success: false,
          error: "Invalid data format: Cache data could not be parsed as JSON.",
        });
        return; // Stop further processing
      }

      // 2. Put into new DB cache, passing metadata directly from old cache
      const newCacheEntry = await putCacheEntry({
        folder: folder,
        identifier: key,
        data: parsedData,
        metadata: oldCacacheMetadata, // Pass metadata directly
      });

      if (newCacheEntry) {
        res.status(200).json({
          success: true,
          message: `Successfully ported cache entry from old cache at '${folder}/${key}' (hashed: ${hashedKey}) to new DB cache.`,
          newEntryId: newCacheEntry.id,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to put cache entry into the new database cache.",
        });
      }
    } catch (error: any) {
      if (error.code === "ENOENT") {
        res.status(404).json({
          success: false,
          error: `Cache entry not found in old cacache for ${folder}/${key} (hashed: ${hashedKey}) at path ${oldCachePath}`,
        });
      } else {
        console.error(
          `Error porting cache entry for ${folder}/${key} (hashed: ${hashedKey}):`,
          error
        );
        res.status(500).json({
          success: false,
          error: error.message || "An unknown error occurred during porting.",
        });
      }
    }
  }
);

export default router;
