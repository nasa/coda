import { getISS } from "services/spacetrack-api";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * `/api/location/iss?date=yyyy-mm-dd`
 *
 * Get spacetrack data
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { year, month, date } = req.query;

  try {
    const data = await getISS(+year, +month, +date);
    res.status(200).json(data);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
