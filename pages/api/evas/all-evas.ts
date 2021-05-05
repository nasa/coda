import type { NextApiRequest, NextApiResponse } from "next";
import { getAllEVAs } from "server/wiki-api";

/**
 * `/api/wiki/all-evas`
 *
 * Get all as-planned EVA data in the wiki
 */
export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const evas = await getAllEVAs();
    res.status(200).json(evas);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
