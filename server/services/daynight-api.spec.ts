import { getTopoURL } from "server/services/daynight-api";

describe("function getTopoURL()", () => {
  const now = new Date();
  it("should return null", () => {
    const requestDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, now.getUTCDate())
    );
    expect(getTopoURL(requestDate)).toBeNull();
  });
  it("should return blank", () => {
    const requestDate = new Date(Date.UTC(2000, 1, 1));
    expect(getTopoURL(requestDate)).toEqual("");
  });
  it("should return predicted url", () => {
    const requestDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 7)
    );
    let url = getTopoURL(requestDate);
    expect(url.includes("/data/stp/")).toBeTruthy();
  });
  it("should return historic (best estimated trajectory) url", () => {
    const requestDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, now.getUTCDate())
    );
    let url = getTopoURL(requestDate);
    expect(url.includes("/data/bet/")).toBeTruthy();
  });
});
