import { getTopoURL, getTopoState } from "server/services/daynight-api";

describe("function getTopoURL()", () => {
  const now = new Date();
  it("should return out of range future", () => {
    const requestDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, now.getUTCDate())
    );
    expect(getTopoURL(requestDate).url).toBeNull();
    expect(getTopoURL(requestDate).state).toEqual("outOfRange_predicted");
  });
  it("should return out of range past", () => {
    const requestDate = new Date(Date.UTC(2000, 1, 1));
    expect(getTopoURL(requestDate).url).toBeNull();
    expect(getTopoURL(requestDate).state).toEqual("outOfRange_historic");
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
  it("should use .cff.txt extension for historic dates before 2015-01-05", () => {
    const requestDate = new Date(Date.UTC(2014, 11, 31)); // December 31, 2014
    let url = getTopoURL(requestDate).url;
    expect(url).toContain(".cff.txt");
    expect(url).not.toContain(".cff.conv.txt");
  });
  it("should use .cff.conv.txt extension for historic dates on or after 2015-01-05", () => {
    const requestDate = new Date(Date.UTC(2015, 0, 5)); // January 5, 2015
    let url = getTopoURL(requestDate).url;
    expect(url).toContain(".cff.conv.txt");
  });
  it("should return predicted state for date exactly at 50-day boundary", () => {
    const boundary = new Date(Date.now());
    boundary.setUTCHours(0, 0, 0, 0);
    boundary.setUTCDate(boundary.getUTCDate() + 49);
    expect(getTopoURL(boundary).state).toEqual("predicted");
  });
  it("should return outOfRange_predicted for date just past 50-day boundary", () => {
    const boundary = new Date(Date.now());
    boundary.setUTCHours(0, 0, 0, 0);
    boundary.setUTCDate(boundary.getUTCDate() + 50);
    expect(getTopoURL(boundary).state).toEqual("outOfRange_predicted");
  });
});

describe("function getTopoState()", () => {
  it("should return historic for date exactly at historic cutoff (2013-03-31)", () => {
    const cutoffDate = new Date(Date.UTC(2013, 2, 31)); // March 31, 2013
    expect(getTopoState(cutoffDate)).toEqual("historic");
  });
  it("should return outOfRange_historic for date just before historic cutoff", () => {
    const beforeCutoff = new Date(Date.UTC(2013, 2, 30)); // March 30, 2013
    expect(getTopoState(beforeCutoff)).toEqual("outOfRange_historic");
  });
  it("should return predicted for today at midnight UTC", () => {
    const today = new Date(Date.now());
    today.setUTCHours(0, 0, 0, 0);
    expect(getTopoState(today)).toEqual("predicted");
  });
});
