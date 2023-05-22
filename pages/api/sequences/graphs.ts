import getGraphManifest from "server/sequences/graph";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Get graph manifest for specific date
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { source, year, month, date, forceNew } = req.query as { [key: string]: string };

  try {
    const data = await getGraphManifest(
      source as Source,
      `${year}-${month.padStart(2, "0")}-${date.padStart(2, "0")}`,
      forceNew === "1"
    );
    res.status(200).json(data);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
