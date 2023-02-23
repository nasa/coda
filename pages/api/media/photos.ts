import type { NextApiRequest, NextApiResponse } from "next";
import getPhotoData from "server/media/photos";
import { Collection } from "utils/enums";

/**
 * `/api/media/photos`
 *
 * Get IO photo data proxied through our API
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { year, month, date, collection, forceNew } = req.query;
  try {
    const photos = await getPhotoData(
      +year,
      +month,
      +date,
      Collection[collection as string],
      forceNew === "1"
    );
    res.status(200).json(photos);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
