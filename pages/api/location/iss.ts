import getISSLocation from "server/location/iss";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * `/api/location/iss?date=yyyy-mm-dd`
 *
 * Get spacetrack data
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { year, month, date } = req.query;

  try {
    const data = await getISSLocation(+year, +month, +date);
    res.status(200).json(data);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
