import { FC, useEffect } from "react";
import { getCurrentUser } from "./getCurrentUser";
import { setupFetchFns } from "./fetchFns";

export const EnsureLogin: FC<{ fqdn?: string }> = ({ fqdn = "" }) => {
  useEffect(() => {
    setupFetchFns();
    getCurrentUser().then((user) => {
      if (user instanceof Error) {
        console.error("Unable to get current user", user);
        return;
      }
      console.log(`Welcome, ${user.display_name || "unknown user"}`);
    });
  }, [fqdn]);

  // component has no display, just ensures login
  return null;
};
