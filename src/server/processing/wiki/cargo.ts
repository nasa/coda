/**
 * Generic Cargo Query Module
 *
 * Provides the base functionality for executing Cargo queries against the MediaWiki API.
 */
import { ConsoleLogger } from "utils/logging/consoleLogger";
import { WIKI_BASE_URL } from "./auth";
import { fetchWithCookies, performLogin } from "./auth";

/** MediaWiki Cargo API default limit is 500 */
const CARGO_DEFAULT_LIMIT = 500;

/**
 * Execute a Cargo query against the wiki
 */
async function cargoQuery<T>(wikiName: WikiName, queryParams: string): Promise<T[]> {
  // Ensure we're logged in
  const loggedIn = await performLogin(wikiName);
  if (!loggedIn) {
    return [];
  }

  const apiUrl = `${WIKI_BASE_URL}/${wikiName}/api.php`;
  const fullUrl = `${apiUrl}?action=cargoquery&${queryParams}&format=json`;

  try {
    const response = await fetchWithCookies(fullUrl, wikiName, { method: "GET" });
    const data = (await response.json()) as CargoResponse<T>;

    if (data.error) {
      ConsoleLogger.error(`Cargo query error: ${data.error.code} - ${data.error.info}`);
      return [];
    }

    if (!data.cargoquery) {
      return [];
    }

    // Extract the "title" object from each row
    return data.cargoquery.map((row) => row.title);
  } catch (error) {
    ConsoleLogger.error("Cargo query failed:", error);
    return [];
  }
}

/**
 * Execute a paginated Cargo query to fetch all results
 *
 * MediaWiki Cargo API has a default limit of 500 results per request.
 * This function automatically paginates through all results.
 */
export async function cargoQueryPaginated<T>(
  wikiName: WikiName,
  queryParams: string,
  maxResults = 10000
): Promise<T[]> {
  const allResults: T[] = [];
  let offset = 0;

  while (allResults.length < maxResults) {
    const paginatedParams = `${queryParams}&offset=${offset}`;
    const results = await cargoQuery<T>(wikiName, paginatedParams);

    if (results.length === 0) {
      break; // No more results
    }

    allResults.push(...results);

    if (results.length < CARGO_DEFAULT_LIMIT) {
      break; // Last page (fewer results than limit)
    }

    offset += CARGO_DEFAULT_LIMIT;
  }

  return allResults;
}
