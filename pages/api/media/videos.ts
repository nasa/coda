import type { NextApiRequest, NextApiResponse } from "next";
import getVideoData from "server/media/videos";

/**
 * `/api/media/videos`
 *
 * Get IO photo data proxied through our API
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { year, month, date, collection } = req.query;
  try {
    const videos = await getVideoData(+year, +month, +date, Collection[collection as string]);
    res.status(200).json(videos);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
