import {
  FetchFn,
  FetchJsonWithAuth,
  createFetchWithAuthFunctions,
  webAuthPopup,
} from "@emss/oauth2-proxy-frontend";
import { prefixUrl } from "utils/basePath";

export let fetchWithAuth: FetchFn = async () => {
  throw new Error("fetchWithAuth() must be initialized first");
};

export let fetchJsonWithAuth: FetchJsonWithAuth = () => {
  throw new Error("fetchJsonWithAuth() must be initialized first");
};

// Prefix only absolute app-relative paths (e.g. `/api/v1/foo`). Leaves
// fully-qualified URLs (https://...) and already-prefixed paths alone.
const maybePrefix = (input: RequestInfo | URL): RequestInfo | URL => {
  if (typeof input !== "string") return input;
  if (!input.startsWith("/")) return input;
  // Avoid double-prefixing if the caller already prepended the base.
  const base = prefixUrl("");
  if (base && input.startsWith(`${base}/`)) return input;
  return prefixUrl(input);
};

export const setupFetchFns = (fqdn: string = ""): void => {
  // login and userinfo paths share the same subpath prefix as the rest of
  // the SPA when deployed under imago. prefixUrl() returns "" for root
  // deploys so behavior is unchanged there.
  const functions = createFetchWithAuthFunctions(
    webAuthPopup,
    fqdn + prefixUrl("/login"),
    fqdn + prefixUrl("/oauth2/userinfo")
  );

  // Wrap the raw fetch helpers so callers can keep passing absolute
  // app-relative paths (`/api/v1/foo`) and we prefix transparently for
  // subpath deploys. See imago/docs/consumer-base-url-rewrite.md.
  const rawFetch = functions.fetchWithAuth;
  const rawFetchJson = functions.fetchJsonWithAuth;
  fetchWithAuth = ((input, init) => rawFetch(maybePrefix(input), init)) as FetchFn;
  fetchJsonWithAuth = ((input, init) =>
    rawFetchJson(maybePrefix(input) as never, init)) as FetchJsonWithAuth;
};
