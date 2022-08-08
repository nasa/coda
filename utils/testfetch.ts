/** See https://dmitripavlutin.com/timeout-fetch-request/ */

import AbortController from "abort-controller";
import fetch from "node-fetch";
import type { Response } from "node-fetch";
import https from "https";

export async function withFetch(url: string) {
  const res = await fetch(url);
  const json = await res.json();

  return json;
}

/**
 * Perform a fetch request that throws if it takes too much time. Timeout defaults to 8 seconds. Usage:
 * `fetchWithTimeout("/url", { timeout: 8000, ...usualFetchOptions })`
 */
export default async function fetchWithTimeout(
  input: string,
  options:
    | RequestInit
    | (any & {
        /** Milliseconds to timeout */
        timeout?: number;
      })
): Promise<Response> {
  const { timeout = 8000 } = options;

  const controller = new AbortController();
  const signal = controller.signal;
  const id = setTimeout(() => controller.abort(), timeout);

  // To avoid invalid cert errors in development environments, don't reject unauthorized certs when in development
  const rejectUnauthorized = process.env.NODE_ENV === "production" ? true : false;

  const httpsAgent = new https.Agent({
    rejectUnauthorized: rejectUnauthorized,
  });
  const response = await fetch(input, {
    headers: options.headers,
    method: "GET",
    agent: httpsAgent,
    signal,
  });

  clearTimeout(id);
  return response;
}
