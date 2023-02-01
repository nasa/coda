import getDayNight from "server/daynight/daynight";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * `/api/daynight/daynight?year=yyyy&month=mm&date=dd`
 *
 * Get day night data
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { year, month, date, preferNew } = req.query;

  const forceRefresh = preferNew === "1";

  try {
    const data = await getDayNight(+year, +month, +date, forceRefresh);
    res.status(200).json(data);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
