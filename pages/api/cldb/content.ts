import type { NextApiRequest, NextApiResponse } from "next";
import getConsoleLog from "server/iss_mcc/cldb";

/**
 * `/api/cldb/content?disciplines=EVA|OSO&year=yyyy&julianday=ddd`
 *
 * Get console log database data
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { disciplines, year, julianday } = req.query as { [key: string]: string };

  if (year.length !== 4 || year !== parseInt(year).toString()) {
    res.status(400).json({ error: "year must be 4-digit integer" });
  }

  if (
    julianday.length !== 3 || // must be three digits
    julianday.split("").filter((c) => c >= "0" && c <= "9").length !== 3 // must all be integers
  ) {
    res.status(400).json({ error: "julian day must be 3-digit integer" });
  }

  const response = await getConsoleLog(disciplines, +year, +julianday);

  res.status(200).json(response);
}
