import { getTopoURL } from "server/services/daynight-api";

describe("function getTopoURL()", () => {
  const now = new Date();
  it("should return out of rnage future", () => {
    const requestDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, now.getUTCDate())
    );
    expect(getTopoURL(requestDate).url).toBeNull();
    expect(getTopoURL(requestDate).state).toEqual("outOfRange_future");
  });
  it("should return out of range past", () => {
    const requestDate = new Date(Date.UTC(2000, 1, 1));
    expect(getTopoURL(requestDate).url).toBeNull();
    expect(getTopoURL(requestDate).state).toEqual("outOfRange_past");
  });
  it("should return predicted url", () => {
    const requestDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 7)
    );
    let url = getTopoURL(requestDate).url;
    expect(url.includes("/data/stp/")).toBeTruthy();
    expect(getTopoURL(requestDate).state).toEqual("predicted");
  });
  it("should return historic (best estimated trajectory) url", () => {
    const requestDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, now.getUTCDate())
    );
    let url = getTopoURL(requestDate).url;
    expect(url.includes("/data/bet/")).toBeTruthy();
    expect(getTopoURL(requestDate).state).toEqual("historic");
  });
});
