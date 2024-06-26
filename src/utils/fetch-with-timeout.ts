/** See https://dmitripavlutin.com/timeout-fetch-request/ */

import AbortController from "abort-controller";

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

  const response = await fetch(url, {
    ...requestInit,
    method: requestInit?.method || "GET",
    signal,
  });

  clearTimeout(id);
  return response;
}
