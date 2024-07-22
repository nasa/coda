import {
  FetchFn,
  FetchJsonWithAuth,
  createFetchWithAuthFunctions,
  webAuthPopup,
} from "@emss/oauth2-proxy-frontend";

export let fetchWithAuth: FetchFn = async () => {
  throw new Error("fetchWithAuth() must be initialized first");
};

export let fetchJsonWithAuth: FetchJsonWithAuth = () => {
  throw new Error("fetchJsonWithAuth() must be initialized first");
};

export const setupFetchFns = (fqdn: string = ""): void => {
  const functions = createFetchWithAuthFunctions(
    webAuthPopup,
    fqdn + "/login",
    fqdn + "/oauth2/userinfo"
  );

  fetchWithAuth = functions.fetchWithAuth;
  fetchJsonWithAuth = functions.fetchJsonWithAuth;
};
