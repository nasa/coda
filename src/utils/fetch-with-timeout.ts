/** See https://dmitripavlutin.com/timeout-fetch-request/ */

import AbortController from "abort-controller";
import fetch from "node-fetch";
import type { Response, RequestInit } from "node-fetch";
import https from "https";

/**
 * node-fetch does not appear to have `credentials` but browser-based fetch does.
 * This may be clarified as fetch is now experimentally native to Node. For now,
 * this type bolts `credentials` on, which may do nothing if actually using node-fetch
 * but will work in browser.
 */
type BrowserRequestInit = RequestInit & { credentials?: FetchOptionsCredentials };

/**
 * Perform a fetch request that throws if it takes too much time. Timeout defaults to 8 seconds. Usage:
 */
export default async function fetchWithTimeout(
  url: string,
  requestInit?: BrowserRequestInit,
  timeout: number = 8000 /** Milliseconds to timeout */
): Promise<Response> {
  const controller = new AbortController();
  const signal = controller.signal as NonNullable<RequestInit["signal"]>;
  const id = setTimeout(() => controller.abort(), timeout);

  // To avoid invalid cert errors in development environments, don't reject unauthorized certs when in development
  const rejectUnauthorized = process.env.NODE_ENV === "production" ? true : false;

  const httpsAgent = new https.Agent({
    rejectUnauthorized: rejectUnauthorized,
  });
  const response = await fetch(url, {
    ...requestInit,
    method: requestInit?.method || "GET",
    agent: httpsAgent,
    signal,
  });

  clearTimeout(id);
  return response;
}
