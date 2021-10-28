import getGPSTracks from "server/ancillary/getGpsTracks";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * /api/ancillary/getAncillaryData?year=yyyy&month=mm&date=dd&eventType=ISS|test_event
 *
 * Get ancillary data from govcloud
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { year, month, date, eventType } = req.query;

  try {
    const data = await getGPSTracks(`${year}-${month}-${date}`, eventType as string);
    res.status(200).json(data);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
