import { clearAll } from "server/services/cache-client";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * `/api/cache/clearAll`
 *
 * Nuke everything in the cache
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await clearAll();
    res.status(200).json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: e.toString() });
  }
}
