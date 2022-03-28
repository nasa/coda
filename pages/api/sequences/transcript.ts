import type { NextApiRequest, NextApiResponse } from "next";
import getWikiTranscript from "server/sequences/transcript";
import { Source } from "utils/enums";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { year, month, date } = req.query as { [key: string]: string };

  try {
    const transcript = await getWikiTranscript(
      Source.ISS,
      `${year}-${month.padStart(2, "0")}-${date}`
    );
    res.status(200).json(transcript);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
