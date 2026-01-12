/**
 * Wiki Authentication Module
 *
 * Handles MediaWiki authentication using bot credentials and cookie session management.
 * Uses fetchWithTimeout with cookie support for reliable requests.

 * The login flow is:
 *
 * 1. **Get Login Token**: Request a login token from the API
 * 2. **Authenticate**: POST credentials with the token
 * 3. **Use Session Cookies**: All subsequent requests include the session cookies
 */
import { RequestInit } from "undici";
import fetchWithTimeout, { CookieOptions } from "utils/fetch-with-timeout";
import { ConsoleLogger } from "utils/logging/consoleLogger";

export const WIKI_BASE_URL = "https://wiki.jsc.nasa.gov";

// Disable SSL certificate verification for NASA internal wiki (self-signed cert)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Default timeout for wiki requests (30 seconds - wiki can be slow)
const WIKI_REQUEST_TIMEOUT = 30000;

// =====================
// Cookie Management
// =====================

/** Simple in-memory cookie store - separate stores per wiki */
const cookieStores: Record<WikiName, string[]> = {
  iss: [],
  exploration: [],
};

/** Login status tracking per wiki */
const loginStatus: Record<WikiName, boolean> = {
  iss: false,
  exploration: false,
};

/**
 * Update cookies from Set-Cookie headers
 */
function updateCookies(wikiName: WikiName, setCookieHeaders: string[]): void {
  for (const cookieStr of setCookieHeaders) {
    const cookiePart = cookieStr.split(";")[0];
    const cookieName = cookiePart.split("=")[0];
    // Update or add cookie (remove existing cookie with same name first)
    cookieStores[wikiName] = cookieStores[wikiName].filter((c) => !c.startsWith(cookieName + "="));
    cookieStores[wikiName].push(cookiePart);
  }
}

/**
 * Make a fetch request with cookie persistence and timeout protection
 */
export async function fetchWithCookies(
  url: string,
  wikiName: WikiName,
  options: RequestInit & { credentials?: string } = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    "User-Agent": "CODA-WikiBot/1.0",
    "X-SKIP-SAML": "True",
    ...((options.headers as Record<string, string>) || {}),
  };

  const cookieOptions: CookieOptions = {
    cookies: cookieStores[wikiName],
    onSetCookie: (cookies) => updateCookies(wikiName, cookies),
  };

  return fetchWithTimeout(url, { ...options, headers }, WIKI_REQUEST_TIMEOUT, cookieOptions);
}

// =====================
// Authentication
// =====================

/**
 * Get a login token from the MediaWiki API
 */
async function getLoginToken(apiUrl: string, wikiName: WikiName): Promise<string> {
  const tokenUrl = `${apiUrl}?action=query&meta=tokens&type=login&format=json`;
  const response = await fetchWithCookies(tokenUrl, wikiName, { method: "GET" });
  const data = (await response.json()) as WikiTokenResponse;
  return data?.query?.tokens?.logintoken || "";
}

/**
 * Authenticate with the MediaWiki API using bot credentials
 */
export async function performLogin(wikiName: WikiName): Promise<boolean> {
  if (loginStatus[wikiName]) {
    return true; // Already logged in
  }

  const apiUrl = `${WIKI_BASE_URL}/${wikiName}/api.php`;
  const username = process.env.WIKI_USER;
  const password = process.env.WIKI_PASSWORD;

  if (!username || !password) {
    ConsoleLogger.warn("WIKI_USER or WIKI_PASSWORD not set. Wiki data will not be available.");
    return false;
  }

  try {
    const loginToken = await getLoginToken(apiUrl, wikiName);

    const loginParams = new URLSearchParams({
      action: "login",
      lgname: username,
      lgpassword: password,
      lgtoken: loginToken,
      format: "json",
    });

    const response = await fetchWithCookies(apiUrl, wikiName, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: loginParams.toString(),
    });

    const data = (await response.json()) as WikiLoginResponse;

    if (data.login?.result === "Success") {
      loginStatus[wikiName] = true;
      ConsoleLogger.info(`Logged in to ${wikiName} wiki as ${data.login.lgusername}`);
      return true;
    } else {
      ConsoleLogger.error(`Wiki login failed for ${wikiName}: ${JSON.stringify(data)}`);
      return false;
    }
  } catch (error) {
    ConsoleLogger.error(`Wiki login error for ${wikiName}:`, error);
    return false;
  }
}
