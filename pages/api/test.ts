import _ from "lodash";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * /api/test?echo=foo
 * Get a query parameter echoed back
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const echo = _.get(req.query, "echo", "") as string;
  const result = await test(echo);
  res.status(200).json({ result });
}

export async function test(echo: string): Promise<string> {
  return Promise.resolve("Your query was " + echo);
}
