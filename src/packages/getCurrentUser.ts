import { asError } from "@emss/utils";
import { EmssUser } from "@emss/oauth2-proxy-common";
// import { fetchJsonWithAuth } from "@emss/oauth2-proxy-frontend";
import { fetchJsonWithAuth } from "./fetchFns";

let currentUser: undefined | EmssUser;

export const getCurrentUser = async (): Promise<EmssUser | Error> => {
  if (currentUser) {
    console.log({ currentUser });
    return currentUser;
  }

  try {
    const json = await fetchJsonWithAuth<{ user: EmssUser }>("/api/v1/user/current");
    if (json instanceof Error) {
      console.error("Unable to get current user", json);
      return;
    }
    currentUser = json.user;

    // eslint-disable-next-line no-console
    console.log(`Welcome, ${currentUser.display_name || "unknown user"}`);

    return currentUser;
  } catch (err) {
    return asError(err);
  }
};

export const clearCurrentUser = (): void => {
  currentUser = undefined;
};
