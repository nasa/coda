import type { NextApiRequest, NextApiResponse } from "next";
import getTranscripts from "server/emss-labs/transcript";
import { Source, Collection } from "utils/enums";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { source, year, month, date, collection, forceNew } = req.query as {
    [key: string]: string;
  };

  try {
    const transcript = await getTranscripts(
      source as Source,
      `${year}-${month.padStart(2, "0")}-${date.padStart(2, "0")}`,
      Collection[collection as string],
      forceNew === "1"
    );
    res.status(200).json(transcript);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
