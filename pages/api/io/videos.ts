import type { NextApiRequest, NextApiResponse } from "next";
import { getVideoData } from "server/io-api";

/**
 * `/api/io/videos`
 *
 * Get IO photo data proxied through our API
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { year, month, date } = req.query;
  try {
    const videos = await getVideoData(+year, +month, +date);
    res.status(200).json(videos);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
