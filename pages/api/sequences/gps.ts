import getGPSTracks from "server/sequences/gps";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * /api/sequences/gps?year=yyyy&month=mm&date=dd&eventType=test_event
 *
 * Get gps tracks from wiki for a given date
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { year, month, date, forceNew } = req.query as { [key: string]: string };

  try {
    const data = await getGPSTracks(
      `${year}-${month.toString().padStart(2, "0")}-${date}`,
      forceNew === "1"
    );
    res.status(200).json(data);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
