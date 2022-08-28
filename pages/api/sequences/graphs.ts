import getGraphManifest from "server/sequences/graph";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Get graph manifest for specific date
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { year, month, date } = req.query as { [key: string]: string };

  try {
    const data = await getGraphManifest(`${year}-${month.toString().padStart(2, "0")}-${date}`);
    res.status(200).json(data);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
