import type { AuthPopup } from "@emss/oauth2-proxy-common";

export type FetchFn = typeof fetch;
type FetchParams = Parameters<FetchFn>;
export type FetchJsonWithAuth = <T extends object>(
  input: FetchParams[0],
  init?: FetchParams[1]
) => Promise<T | Error>;

export declare const createFetchWithAuthFunctions: (
  authPopup: AuthPopup,
  loginURL: string,
  userInfoURL: string
) => { fetchWithAuth: FetchFn; fetchJsonWithAuth: FetchJsonWithAuth };
export declare const webAuthPopup: AuthPopup;