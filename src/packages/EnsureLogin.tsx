import { FC, useEffect } from "react";
import { getCurrentUser } from "./getCurrentUser";
import { setupFetchFns } from "./fetchFns";

console.log("ensure login loaded");

export const EnsureLogin: FC<{ fqdn?: string }> = ({ fqdn = "" }) => {
  console.log("ensure login component render");
  useEffect(() => {
    setupFetchFns();
    getCurrentUser().then((user) => {
      console.log("got current user promise", user);
    });
  }, [fqdn]);

  // component has no display, just ensures login
  return null;
};
