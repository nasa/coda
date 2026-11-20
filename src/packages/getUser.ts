import { getUserFromJWT } from "@emss/oauth2-proxy-backend";
import { EmssUser, EMSSRole } from "@emss/oauth2-proxy-common";
import { Request } from "express";

const getMockUser = (): EmssUser => {
  const getBoolean = (value: string | undefined, fallback: boolean): boolean =>
    value === undefined ? fallback : value === "true";

  return {
    uupic: process.env.MOCK_USER_UUPIC || "local-user",
    email: process.env.MOCK_USER_EMAIL || "developer@example.com",
    auid: process.env.MOCK_USER_AUID || "localdev",
    givenname: process.env.MOCK_USER_GIVENNAME || "Local",
    surname: process.env.MOCK_USER_SURNAME || "Developer",
    display_name: process.env.MOCK_USER_DISPLAYNAME || "Developer, Local",
    roles: process.env.MOCK_USER_ROLES
      ? (process.env.MOCK_USER_ROLES.split(",") as EMSSRole[])
      : [
          "AEGIS-Editor",
          "AEGIS-Superuser",
          "CODA-Superuser",
          "Maestro-Superuser",
          "EMSS-Superuser",
        ],
    uscitizen: getBoolean(process.env.MOCK_USER_USCITIZEN, true),
    legal_permanent_resident: getBoolean(process.env.MOCK_USER_LPR, true),
    usperson: getBoolean(process.env.MOCK_USER_USPERSON, true),
    ip_address: "127.0.0.1",
  };
};

export const getUser = (req: Request): EmssUser | Error => {
  if (process.env.MOCK_USER === "true") {
    return getMockUser();
  }
  return getUserFromJWT(req);
};
