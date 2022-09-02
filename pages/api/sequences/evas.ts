import type { NextApiRequest, NextApiResponse } from "next";
import getEVAData from "server/sequences/evas";

/**
 * `/api/sequences/evas`
 *
 * Query Params:
 *  agency=us|rs|all - default us
 *   if 'us', only US EVAs. if 'rs', only RS EVAs. if 'all', all EVAs
 *
 * Get all as-planned EVA data in the wiki
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { agency = "us" } = req.query as { [key: string]: string };

  try {
    const evas = await getEVAData(agency as AgencyQuery);
    res.status(200).json(evas);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
