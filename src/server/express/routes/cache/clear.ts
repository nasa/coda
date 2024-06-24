import { clearCacheByIdentifer, clearCacheByFolder } from "server/processing/cache-client";
import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";

/**
 * `/api/cache/clear`
 *
 * The folder name must match a CacheFolder enum key
 */

const router = express.Router();

const parseQuery = (query: Query) => {
  const { folder, identifier } = query;
  const queryObj = {
    folder: folder ? (folder as CacheFolder) : undefined,
    identifier: identifier ? (identifier as string) : undefined,
  };
  return queryObj;
};

// get
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const queryObj = parseQuery(req.query);
  try {
    if (typeof queryObj.folder === "undefined") {
      res.status(200).json({ success: false, error: "invalid folder specified" });
      return;
    } else {
      if (queryObj.identifier) {
        await clearCacheByIdentifer(queryObj.identifier, queryObj.folder);
        res.status(200).json({ success: true });
        return;
      } else {
        await clearCacheByFolder(queryObj.folder);
        res.status(200).json({ success: true });
        return;
      }
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.toString() });
    return;
  }
});

export default router;
