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
 * Options for cookie management in fetchWithTimeout
 */
export interface CookieOptions {
  /** Current cookies to send with the request */
  cookies?: string[];
  /** Callback to receive updated cookies from Set-Cookie headers */
  onSetCookie?: (cookies: string[]) => void;
}

/**
 * Perform a fetch request that throws if it takes too much time. Timeout defaults to 8 seconds.
 *
 * @param url - The URL to fetch
 * @param requestInit - Standard fetch options plus optional credentials
 * @param timeout - Milliseconds to timeout (default: 8000)
 * @param cookieOptions - Optional cookie management for session persistence
 */
export default async function fetchWithTimeout(
  url: string,
  requestInit?: RequestInit & { credentials?: string },
  timeout: number = 8000,
  cookieOptions?: CookieOptions
): Promise<Response> {
  const controller = new AbortController();
  const signal = controller.signal;
  const id = setTimeout(() => controller.abort(), timeout);

  // Build headers with optional cookie support
  const headers: Record<string, string> = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };

  // Merge in any provided headers from requestInit
  if (requestInit?.headers) {
    const initHeaders = requestInit.headers as Record<string, string>;
    Object.assign(headers, initHeaders);
  }

  // Add cookies if provided
  if (cookieOptions?.cookies && cookieOptions.cookies.length > 0) {
    headers["Cookie"] = cookieOptions.cookies.join("; ");
  }

  try {
    const response = await fetch(url, {
      ...requestInit,
      method: requestInit?.method || "GET",
      signal,
      dispatcher: sharedAgent,
      cache: "no-store",
      headers,
    });

    // Extract and pass back any Set-Cookie headers
    if (cookieOptions?.onSetCookie) {
      const setCookieHeaders = response.headers.getSetCookie?.() || [];
      if (setCookieHeaders.length > 0) {
        cookieOptions.onSetCookie(setCookieHeaders);
      }
    }

    clearTimeout(id);
    return response as unknown as Response; // Type casting to standard Response
  } catch (e) {
    clearTimeout(id);
  }

  // return a response object with status 408 (timeout)
  return new Response(null, { status: 408 });
}
