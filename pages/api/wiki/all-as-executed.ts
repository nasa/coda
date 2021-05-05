import type { NextApiRequest, NextApiResponse } from "next";
import { getAllAsExecuted } from "server/wiki-api";

/**
 * `/api/wiki/all-as-executed`
 *
 * Get all as-executed EVA data in the wiki
 */
export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const evas = await getAllAsExecuted();
    res.status(200).json(evas);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
