import type { NextApiRequest, NextApiResponse } from "next";
import { buildEVAStore } from "services/wiki-api";

/**
 * `/api/sequences/evas`
 *
 * Get all as-planned EVA data in the wiki
 */
export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const evas = await buildEVAStore();
    res.status(200).json(evas);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
