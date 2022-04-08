import type { NextApiRequest, NextApiResponse } from "next";
import getSgAudio from "server/emss-labs/sgAudio";
import { Source } from "utils/enums";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { year, month, date } = req.query as { [key: string]: string };

  try {
    const response = await getSgAudio(
      Source.ISS,
      `${year}-${month.padStart(2, "0")}-${date.padStart(2, "0")}`
    );
    res.status(200).json(response);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
