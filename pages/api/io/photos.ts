import { performance } from "perf_hooks";
import type { NextApiRequest, NextApiResponse } from "next";
import { getPhotoData } from "server/io-api";

/**
 * `/api/io/photos`
 *
 * Get IO photo data proxied through our API
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { year, month, date } = req.query;
  try {
    const startTime = performance.now();
    const photos = await getPhotoData(+year, +month, +date);
    console.log(`Photos elapsed time: ${performance.now() - startTime}ms`);
    res.status(200).json(photos);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
