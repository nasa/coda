import { getUserFromJWT } from "@emss/oauth2-proxy-backend";
import { EmssUser, EMSSRole } from "@emss/oauth2-proxy-common";
import { Request } from "express";

const getMockUser = (): EmssUser => {
  return {
    uupic: process.env.MOCK_USER_UUPIC || "1234",
    email: process.env.MOCK_USER_EMAIL || "neil.armstrong@nasa.gov",
    auid: process.env.MOCK_USER_AUID || "narmstra",
    givenname: process.env.MOCK_USER_GIVENNAME || "Neil",
    surname: process.env.MOCK_USER_SURNAME || "Armstrong",
    display_name: process.env.MOCK_USER_DISPLAYNAME || "Armstrong, Neil A. (JSC-CB611)",
    roles: process.env.MOCK_USER_ROLES
      ? (process.env.MOCK_USER_ROLES.split(",") as EMSSRole[])
      : [
          "AEGIS-Editor",
          "AEGIS-Superuser",
          "CODA-Superuser",
          "Maestro-Superuser",
          "EMSS-Superuser",
        ],
    uscitizen: process.env.MOCK_USER_USCITIZEN ? Boolean(process.env.MOCK_USER_USCITIZEN) : true,
    legal_permanent_resident: process.env.MOCK_USER_LPR ? Boolean(process.env.MOCK_USER_LPR) : true,
    usperson: process.env.MOCK_USER_USPERSON ? Boolean(process.env.MOCK_USER_USPERSON) : true,
  };
};

export const getUser = (req: Request): EmssUser | Error => {
  if (process.env.MOCK_USER) {
    return getMockUser();
  }
  return getUserFromJWT(req);
};
