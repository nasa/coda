import type { NextApiRequest, NextApiResponse } from "next";
import getMaestroExecuteTimelineStatus from "server/maestro/maestro";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { uuid } = req.query as { [key: string]: string };

  try {
    const response = await getMaestroExecuteTimelineStatus(uuid);
    res.status(200).json(response);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
  }
}
