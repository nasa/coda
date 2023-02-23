import { clearCacheByIdentifer, clearCacheByFolder } from "server/services/cache-client";
import type { NextApiRequest, NextApiResponse } from "next";
import { CacheFolder } from "utils/enums";

/**
 * `/api/cache/clear`
 *
 * The folder name must match a CacheFolder enum key
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { folder, identifier } = req.query as { [key: string]: string };
  try {
    if (typeof CacheFolder[folder] === "undefined") {
      res.status(200).json({ success: false, error: "invalid folder specified" });
    } else {
      if (identifier) {
        await clearCacheByIdentifer(identifier, CacheFolder[folder]);
        res.status(200).json({ success: true });
      } else {
        await clearCacheByFolder(CacheFolder[folder]);
        res.status(200).json({ success: true });
      }
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.toString() });
  }
}
