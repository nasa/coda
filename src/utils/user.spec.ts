import { isSuperuser } from "./user";
import { EmssUser } from "@emss/oauth2-proxy-common";

describe("isSuperuser", () => {
  const createUser = (roles: string[]): EmssUser => ({
    uupic: "1234",
    email: "test@nasa.gov",
    auid: "testuser",
    givenname: "Test",
    surname: "User",
    display_name: "User, Test (JSC-XX)",
    roles: roles as any,
    uscitizen: true,
    legal_permanent_resident: true,
    usperson: true,
    ip_address: "1.2.3.4",
  });

  it("should return true for user with CODA-Superuser role", () => {
    const user = createUser(["CODA-Superuser", "AEGIS-Editor"]);
    expect(isSuperuser(user)).toBe(true);
  });

  it("should return true for user with EMSS-Superuser role", () => {
    const user = createUser(["EMSS-Superuser"]);
    expect(isSuperuser(user)).toBe(true);
  });

  it("should return true for user with both superuser roles", () => {
    const user = createUser(["EMSS-Superuser", "CODA-Superuser"]);
    expect(isSuperuser(user)).toBe(true);
  });

  it("should return false for user without superuser roles", () => {
    const user = createUser(["AEGIS-Editor", "Maestro-Editor"]);
    expect(isSuperuser(user)).toBe(false);
  });

  it("should return false for user with no roles array", () => {
    const user = createUser([]);
    expect(isSuperuser(user)).toBe(false);
  });

  it("should return false for null user", () => {
    expect(isSuperuser(null)).toBe(false);
  });

  it("should return false for undefined user", () => {
    expect(isSuperuser(undefined)).toBe(false);
  });

  it("should return false for user with undefined roles", () => {
    const user = createUser(["AEGIS-Editor"]);
    delete (user as any).roles;
    expect(isSuperuser(user)).toBe(false);
  });
});
