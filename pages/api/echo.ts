import _ from "lodash";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * `/api/echo?word=foo`
 *
 * Get a query parameter echoed back
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const word = _.get(req.query, "word", "") as string;
  const result = await test(word);
  res.status(200).json({ result });
}

export async function test(word: string): Promise<string> {
  return Promise.resolve(`Your word was '${word}'`);
}
