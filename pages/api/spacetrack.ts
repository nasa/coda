import isNull from "lodash/isNull";
import { getISS } from "server/spacetrack-api";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * `/api/spacetrack?date=yyyy-mm-dd`
 *
 * Get spacetrackdata
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { year, month, date } = req.query;

  // TODO: check if the date is sane

  try {
    const data = getISS(+year, +month, +date);
    res.status(200).json(data);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
