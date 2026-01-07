import { fetch, RequestInit, Agent } from "undici";

// To avoid invalid cert errors in development environments, don't reject unauthorized certs when in development
const rejectUnauthorized = process.env.NODE_ENV === "production";

// Create a single shared agent to avoid socket/connection leaks
// Previously, a new Agent was created on every fetch call, which leaked connections
const sharedAgent = new Agent({
  connect: {
    rejectUnauthorized: rejectUnauthorized,
  },
  // Connection pool settings to prevent unbounded growth
  connections: 100, // max connections per origin
  pipelining: 1, // disable pipelining for simpler connection management
  keepAliveTimeout: 30000, // 30 seconds keep-alive
  keepAliveMaxTimeout: 60000, // max 60 seconds for keep-alive
});

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

  try {
    const response = await fetch(url, {
      ...requestInit,
      method: requestInit?.method || "GET",
      signal,
      dispatcher: sharedAgent,
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        ...requestInit?.headers,
      },
    });

    clearTimeout(id);
    return response as unknown as Response; // Type casting to standard Response
  } catch (e) {
    clearTimeout(id);
  }

  // return a response object with status 408 (timeout)
  return new Response(null, { status: 408 });
}
