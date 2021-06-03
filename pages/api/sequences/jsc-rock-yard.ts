import type { NextApiRequest, NextApiResponse } from "next";
import { buildJSCRockYardStore } from "server/wiki-api";

/**
 * `/api/sequences/rock-yard`
 *
 * Get all as-planned rock yard data in the wiki
 */
export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const evas = await buildJSCRockYardStore();
    res.status(200).json(evas);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
