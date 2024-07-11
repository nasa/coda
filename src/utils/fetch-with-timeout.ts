import { fetch, RequestInit, Agent } from "undici";

/**
 * Perform a fetch request that throws if it takes too much time. Timeout defaults to 8 seconds. Usage:
 */
export default async function fetchWithTimeout(
  url: string,
  requestInit?: RequestInit & { credentials?: string },
  timeout: number = 8000 /** Milliseconds to timeout */
): Promise<Response> {
  const controller = new AbortController();
  const signal = controller.signal;
  const id = setTimeout(() => controller.abort(), timeout);

  // To avoid invalid cert errors in development environments, don't reject unauthorized certs when in development
  const rejectUnauthorized = process.env.NODE_ENV === "production";

  const agent = new Agent({
    connect: {
      rejectUnauthorized: rejectUnauthorized,
    },
  });

  const response = await fetch(url, {
    ...requestInit,
    method: requestInit?.method || "GET",
    signal,
    dispatcher: agent,
  });

  clearTimeout(id);
  return response as unknown as Response; // Type casting to standard Response
}
