/**
 * Base-URL helpers for subpath deploys (imago previews).
 *
 * The Vite build sets `base: '/__BASE_URL__/'` in production and exposes
 * the same literal via the build-time global `__VITE_BASE_URL__`. nginx
 * substitutes `/__BASE_URL__` for the deploy-specific prefix at request
 * time (empty for root deploys, `/emss/coda/<branch>` for imago tenants).
 * See imago/docs/consumer-base-url-rewrite.md.
 *
 * Single source of truth for both frontend and server code so callers
 * never need to read `import.meta.env.BASE_URL` or the global directly.
 */

/**
 * Client-side read of the Vite base. Returns the value with its trailing
 * slash intact (`'/'` for root deploys, `'/emss/coda/<branch>/'` for
 * imago). Reads from the build-time global to avoid `import.meta.env`
 * literals in modules that may be loaded by non-Vite test loaders.
 */
export const getViteBase = (): string =>
  typeof __VITE_BASE_URL__ === "string" ? __VITE_BASE_URL__ : "/";

/**
 * Client-side base with no trailing slash. Useful for building URLs by
 * concatenation: `` `${baseUrlNoTrailingSlash()}/api/v1/foo` ``. Returns
 * `''` for root deploys so concatenation yields an absolute path
 * (`/api/v1/foo`), and `/emss/coda/<branch>` for imago tenants.
 */
export const baseUrlNoTrailingSlash = (): string =>
  getViteBase().replace(/\/$/, "");

/**
 * Server-side read of the imago subpath prefix. Returns `''` for root
 * deploys (prod, int, dev VMs), or `/emss/coda/<branch>` for an imago
 * tenant. Always normalized with no trailing slash so callers can write
 * `` `${getBasePath()}/foo` ``.
 *
 * Trade-off: callers persisting this into stored data or outbound URLs
 * are making the result deployment-path-dependent. For URLs that stay
 * inside the app, prefer prefixing at render time on the frontend.
 */
export const getBasePath = (): string =>
  (process.env.BASE_URL_REPLACE ?? "").replace(/\/$/, "");
