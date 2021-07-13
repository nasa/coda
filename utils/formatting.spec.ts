import { getJulianDate } from "utils/formatting";

/**
 * Shortcut for making a UTC Date
 * @param year UTC yyyy
 * @param month UTC zero-indexed month
 * @param day UTC day of the month
 * @returns A UTC date
 */
function makeDate(year: number, month: number, day: number): Date {
  const dt = new Date();
  dt.setUTCDate(day);
  dt.setUTCMonth(month);
  dt.setUTCFullYear(year);
  return dt;
}

describe("utils/formatting", () => {
  describe("getJulianDate", () => {
    it("should handle jan 1", () => {
      const year = 2021;
      const dt = makeDate(year, 0, 1);
      expect(getJulianDate(dt)).toEqual(`${year}/1`);
    });

    it("should handle feb 1", () => {
      const year = 2021;
      const dt = makeDate(year, 1, 1);
      expect(getJulianDate(dt)).toEqual(`${year}/32`);
    });

    it("should handle march 1 non-leap year", () => {
      const year = 2021;
      const dt = makeDate(year, 2, 1);
      expect(getJulianDate(dt)).toEqual(`${year}/60`);
    });

    it("should handle march 1 leap year", () => {
      const year = 2020;
      const dt = makeDate(year, 2, 1);
      expect(getJulianDate(dt)).toEqual(`${year}/61`);
    });

    it("should handle dec 31 non-leap year", () => {
      const year = 2021;
      const dt = makeDate(year, 11, 31);
      expect(getJulianDate(dt)).toEqual(`${year}/365`);
    });
  });
});
