import { EmssUser } from "@emss/oauth2-proxy-common";
import { sanitizeAuids, userIsInGrant } from "./accessGrants";

const createUser = (auid: string, roles: string[] = []): EmssUser => ({
  uupic: "1234",
  email: "test@nasa.gov",
  auid,
  givenname: "Test",
  surname: "User",
  display_name: "User, Test (JSC-XX)",
  roles: roles as EmssUser["roles"],
  uscitizen: true,
  legal_permanent_resident: true,
  usperson: true,
  ip_address: "1.2.3.4",
});

describe("sanitizeAuids", () => {
  it("returns an empty array for an empty array", () => {
    expect(sanitizeAuids([])).toEqual([]);
  });

  it("trims whitespace and drops entries that are blank after trimming", () => {
    expect(sanitizeAuids(["  narmstra  ", "   ", "\t\n", "ealdrin"])).toEqual([
      "narmstra",
      "ealdrin",
    ]);
  });

  it("lowercases every AUID", () => {
    expect(sanitizeAuids(["NArmstra", "EAldrin"])).toEqual(["narmstra", "ealdrin"]);
  });

  it("returns null when any entry is not a string", () => {
    expect(sanitizeAuids(["narmstra", 42])).toBeNull();
    expect(sanitizeAuids(["narmstra", null])).toBeNull();
    expect(sanitizeAuids(["narmstra", { auid: "ealdrin" }])).toBeNull();
  });

  it("returns null when input is not an array", () => {
    expect(sanitizeAuids("narmstra")).toBeNull();
    expect(sanitizeAuids(undefined)).toBeNull();
    expect(sanitizeAuids(null)).toBeNull();
    expect(sanitizeAuids({})).toBeNull();
  });
});

describe("userIsInGrant", () => {
  it("returns true for a superuser even when not in the grant's auids", () => {
    const user = createUser("narmstra", ["CODA-Superuser"]);
    expect(userIsInGrant(user, { auids: ["ealdrin"] })).toBe(true);
  });

  it("returns true for a superuser when the grant has no auids at all", () => {
    const user = createUser("narmstra", ["EMSS-Superuser"]);
    expect(userIsInGrant(user, { auids: [] })).toBe(true);
  });

  it("returns true when the user's AUID is in the grant", () => {
    const user = createUser("narmstra");
    expect(userIsInGrant(user, { auids: ["ealdrin", "narmstra"] })).toBe(true);
  });

  it("is case-insensitive when matching the user's AUID against the grant", () => {
    const user = createUser("NArmstra");
    expect(userIsInGrant(user, { auids: ["narmstra"] })).toBe(true);
  });

  it("returns false when the user is not a superuser and not in the grant", () => {
    const user = createUser("narmstra");
    expect(userIsInGrant(user, { auids: ["ealdrin"] })).toBe(false);
  });

  it("returns false when the user has no auid", () => {
    const user = createUser("");
    expect(userIsInGrant(user, { auids: ["narmstra"] })).toBe(false);
  });

  it("returns false for a null or undefined user", () => {
    expect(userIsInGrant(null, { auids: ["narmstra"] })).toBe(false);
    expect(userIsInGrant(undefined, { auids: ["narmstra"] })).toBe(false);
  });

  it("returns false when grant.auids is not an array", () => {
    const user = createUser("narmstra");
    expect(userIsInGrant(user, { auids: undefined as unknown as string[] })).toBe(false);
  });
});
