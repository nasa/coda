import type { NextApiRequest, NextApiResponse } from "next";
import getEVAData from "server/sequences/evas";

/**
 * `/api/sequences/evas`
 *
 * Get all as-planned EVA data in the wiki
 */
export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const evas = await getEVAData();
    res.status(200).json(evas);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
