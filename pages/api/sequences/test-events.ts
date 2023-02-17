import type { NextApiRequest, NextApiResponse } from "next";
import getTestEventsData from "server/sequences/test-events";

/**
 * `/api/sequences/rock-yard`
 *
 * Get all as-planned test event data in the wiki
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { forceNew } = req.query as { [key: string]: string };

  try {
    const testEvents = await getTestEventsData(forceNew === "1");
    res.status(200).json(testEvents);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
