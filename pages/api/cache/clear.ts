import { clear } from "server/cache-client";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * `/api/cache/clear`
 *
 * Nuke everything in the cache
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await clear();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.toString() });
    return;
  }
  res.status(200).json({ ok: true });
}
