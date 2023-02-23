/** See https://dmitripavlutin.com/timeout-fetch-request/ */

import AbortController from "abort-controller";
import fetch, { RequestInit } from "node-fetch";
import type { Response } from "node-fetch";
import https from "https";

/**
 * Perform a fetch request that throws if it takes too much time. Timeout defaults to 8 seconds. Usage:
 */
export default async function fetchWithTimeout(
  url: string,
  requestInit?: RequestInit,
  timeout: number = 8000 /** Milliseconds to timeout */
): Promise<Response> {
  const controller = new AbortController();
  const signal = controller.signal;
  const id = setTimeout(() => controller.abort(), timeout);

  // To avoid invalid cert errors in development environments, don't reject unauthorized certs when in development
  const rejectUnauthorized = process.env.NODE_ENV === "production" ? true : false;

  const httpsAgent = new https.Agent({
    rejectUnauthorized: rejectUnauthorized,
  });
  const response = await fetch(url, {
    ...requestInit,
    method: requestInit.method || "GET",
    agent: httpsAgent,
    signal,
  });

  clearTimeout(id);
  return response;
}
