import getDayNight from "server/daynight/daynight";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * `/api/daynight/daynight?year=yyyy&month=mm&date=dd`
 *
 * Get day night data
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { year, month, date, forceNew, source } = req.query;
  const dataSource = Array.isArray(source) ? source[0] : source;
  try {
    const data = await getDayNight(+year, +month, +date, forceNew === "1", dataSource);
    res.status(200).json(data);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
