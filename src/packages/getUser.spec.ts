import { vi } from "vitest";
import type { Mock } from "vitest";
import { getUser } from "./getUser";
import { getUserFromJWT } from "@emss/oauth2-proxy-backend";
import { EmssUser } from "@emss/oauth2-proxy-common";
import { Request } from "express";

vi.mock("@emss/oauth2-proxy-backend");

const getUserFromJWTMock = getUserFromJWT as Mock;

describe("getUser", () => {
  let mockRequest: Partial<Request>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequest = {
      headers: {},
    };
    delete process.env.MOCK_USER;
  });

  afterEach(() => {
    delete process.env.MOCK_USER;
  });

  describe("with real authentication", () => {
    it("should call getUserFromJWT and return the user", () => {
      const expectedUser = {
        uupic: "5678",
        email: "real.user@nasa.gov",
        auid: "realuser",
        givenname: "Real",
        surname: "User",
        display_name: "User, Real (JSC-TEST)",
        roles: ["CODA-Superuser"],
        uscitizen: true,
        legal_permanent_resident: true,
        usperson: true,
        ip_address: "10.0.0.1",
      };

      getUserFromJWTMock.mockReturnValue(expectedUser as EmssUser);

      const result = getUser(mockRequest as Request);

      expect(getUserFromJWTMock).toHaveBeenCalledWith(mockRequest);
      expect(result).toEqual(expectedUser);
    });

    it("should return Error when getUserFromJWT returns an Error", () => {
      const expectedError = new Error("Unable to decode JWT");
      getUserFromJWTMock.mockReturnValue(expectedError);

      const result = getUser(mockRequest as Request);

      expect(getUserFromJWTMock).toHaveBeenCalledWith(mockRequest);
      expect(result).toEqual(expectedError);
    });
  });

  describe("with mock user enabled", () => {
    beforeEach(() => {
      process.env.MOCK_USER = "true";
    });

    it("should return mock user with default values", () => {
      const result = getUser(mockRequest as Request);

      expect(getUserFromJWTMock).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        uupic: "1234",
        email: "neil.armstrong@nasa.gov",
        auid: "narmstra",
        givenname: "Neil",
        surname: "Armstrong",
        display_name: "Armstrong, Neil A. (JSC-CB611)",
        roles: expect.arrayContaining([
          "AEGIS-Editor",
          "AEGIS-Superuser",
          "CODA-Superuser",
          "Maestro-Superuser",
          "EMSS-Superuser",
        ]),
        uscitizen: true,
        legal_permanent_resident: true,
        usperson: true,
        ip_address: "1.2.3.4",
      });
    });

    it("should use custom environment variables for mock user", () => {
      process.env.MOCK_USER_UUPIC = "9999";
      process.env.MOCK_USER_EMAIL = "custom@nasa.gov";
      process.env.MOCK_USER_AUID = "customuser";
      process.env.MOCK_USER_GIVENNAME = "Custom";
      process.env.MOCK_USER_SURNAME = "TestUser";
      process.env.MOCK_USER_DISPLAYNAME = "TestUser, Custom (JSC-CUSTOM)";
      process.env.MOCK_USER_ROLES = "CODA-Superuser,AEGIS-Editor";

      const result = getUser(mockRequest as Request);

      expect(result).toMatchObject({
        uupic: "9999",
        email: "custom@nasa.gov",
        auid: "customuser",
        givenname: "Custom",
        surname: "TestUser",
        display_name: "TestUser, Custom (JSC-CUSTOM)",
        roles: ["CODA-Superuser", "AEGIS-Editor"],
      });

      // Cleanup
      delete process.env.MOCK_USER_UUPIC;
      delete process.env.MOCK_USER_EMAIL;
      delete process.env.MOCK_USER_AUID;
      delete process.env.MOCK_USER_GIVENNAME;
      delete process.env.MOCK_USER_SURNAME;
      delete process.env.MOCK_USER_DISPLAYNAME;
      delete process.env.MOCK_USER_ROLES;
    });
  });
});
