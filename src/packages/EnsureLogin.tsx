import { FC, useEffect } from "react";
import { getCurrentUser } from "./getCurrentUser";
import { setupFetchFns } from "./fetchFns";
import { useAppDispatch } from "utils/useAppDispatch";
import { setUser } from "store/user";

export const EnsureLogin: FC<{ fqdn?: string }> = ({ fqdn = "" }) => {
  const dispatch = useAppDispatch();
  useEffect(() => {
    setupFetchFns();
    getCurrentUser().then((user) => {
      if (user instanceof Error) {
        console.error("Unable to get current user", user);
        return;
      }
      console.log(`Welcome, ${user.display_name || "unknown user"}`);
      dispatch(setUser(user));
    });
  }, [fqdn]);

  // component has no display, just ensures login
  return null;
};
