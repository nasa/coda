import { addMs, diff, isSameDate, midnightZulu, mmddyy } from "./date";

describe("date functions", () => {
  it("should return mmddyy", () => {
    const testDate = new Date(Date.UTC(2015, 0, 3));
    expect(mmddyy(testDate)).toEqual("010315");

    testDate.setUTCDate(25);
    testDate.setUTCMonth(11);
    expect(mmddyy(testDate)).toEqual("122515");
  });
});

describe("midnightZulu", () => {
  test("returns a date with time set to 0:0:0:0 UTC", () => {
    const inputDate = new Date("2023-05-24T12:34:56Z");
    const expectedDate = new Date("2023-05-24T00:00:00Z");

    const result = midnightZulu(inputDate);

    expect(result.toISOString()).toBe(expectedDate.toISOString());
  });

  test("does not modify the original date object", () => {
    const inputDate = new Date("2023-05-24T12:34:56Z");
    const originalDate = new Date(inputDate);

    midnightZulu(inputDate);

    expect(inputDate.toISOString()).toBe(originalDate.toISOString());
  });
});

describe("diff", () => {
  test("returns the correct difference in milliseconds between two dates", () => {
    const dateA = new Date("2023-05-24T12:00:00Z");
    const dateB = new Date("2023-05-24T10:30:00Z");
    const expectedDiff = 5400000; // 1 hour = 60 minutes * 60 seconds * 1000 milliseconds

    const result = diff(dateA, dateB);

    expect(result).toBe(expectedDiff);
  });

  test("returns 0 if both dates are the same", () => {
    const dateA = new Date("2023-05-24T12:00:00Z");
    const dateB = new Date(dateA);

    const result = diff(dateA, dateB);

    expect(result).toBe(0);
  });
});

describe("addMs", () => {
  test("returns a new Date advanced by the specified number of milliseconds", () => {
    const initialDate = new Date("2023-05-24T12:00:00Z");
    const millisecondsToAdd = 3000; // 3 seconds
    const expectedDate = new Date("2023-05-24T12:00:03Z");

    const result = addMs(initialDate, millisecondsToAdd);

    expect(result.toISOString()).toBe(expectedDate.toISOString());
  });

  test("does not modify the original Date object", () => {
    const initialDate = new Date("2023-05-24T12:00:00Z");
    const millisecondsToAdd = 5000;
    const originalDate = new Date(initialDate);

    addMs(initialDate, millisecondsToAdd);

    expect(initialDate.toISOString()).toBe(originalDate.toISOString());
  });
});

describe("isSameDate", () => {
  test("returns true if the dates have the same UTC date", () => {
    const dateA = new Date("2023-05-24T12:00:00Z");
    const dateB = new Date("2023-05-24T09:00:00Z");

    const result = isSameDate(dateA, dateB);

    expect(result).toBe(true);
  });

  test("returns false if the dates have different UTC dates", () => {
    const dateA = new Date("2023-05-24T12:00:00Z");
    const dateB = new Date("2023-05-25T12:00:00Z");

    const result = isSameDate(dateA, dateB);

    expect(result).toBe(false);
  });

  test("returns true if the dates have the same UTC date regardless of the time", () => {
    const dateA = new Date("2023-05-24T00:00:00Z");
    const dateB = new Date("2023-05-24T23:59:59Z");

    const result = isSameDate(dateA, dateB);

    expect(result).toBe(true);
  });
});

describe("mmddyy", () => {
  test("returns the MMDDYY string representation of a date in UTC", () => {
    const date = new Date("2023-05-24T12:00:00Z");
    const expectedString = "052423";

    const result = mmddyy(date);

    expect(result).toBe(expectedString);
  });

  test("pads single-digit month and date with zeros", () => {
    const date = new Date("2023-02-04T00:00:00Z");
    const expectedString = "020423";

    const result = mmddyy(date);

    expect(result).toBe(expectedString);
  });
});
