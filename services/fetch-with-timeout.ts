/** See https://dmitripavlutin.com/timeout-fetch-request/ */

import AbortController from "abort-controller";

/**
 * Perform a fetch request that throws if it takes too much time. Timeout defaults to 8 seconds. Usage:
 * `fetchWithTimeout("/url", { timeout: 8000, ...usualFetchOptions })`
 */
export default async function fetchWithTimeout(
  input: RequestInfo,
  options: RequestInit & {
    /** Milliseconds to timeout */
    timeout?: number;
  }
) {
  const { timeout = 8000 } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const response = await fetch(input, {
    ...options,
    signal: controller.signal,
  });
  clearTimeout(id);

  return response;
}
