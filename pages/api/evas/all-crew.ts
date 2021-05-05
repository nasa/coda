import type { NextApiRequest, NextApiResponse } from "next";
import { getAllCrew } from "server/wiki-api";

/**
 * `/api/wiki/all-crew`
 *
 * Get all EVA crew data in the wiki
 */
export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const evas = await getAllCrew();
    res.status(200).json(evas);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
