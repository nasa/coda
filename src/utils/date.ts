import { padZeros } from "./formatting";

/**
 * Sets the time to 0:0:0 UTC for a given date
 * @param d date
 * @returns date with cleared 0:0:0:0 time
 */
export const midnightZulu = (d: Date): Date => {
  const ret = new Date(d);
  ret.setUTCHours(0);
  ret.setUTCMinutes(0);
  ret.setUTCSeconds(0);
  ret.setUTCMilliseconds(0);
  return ret;
};

/**
 * Get the number of milliseconds between two dates, equivalent to `a - b`
 */
export const diff = (a: Date, b: Date): number => {
  return a.getTime() - b.getTime();
};

/**
 * Advance a Date by some number of milliseconds
 */
export const addMs = (d: Date, ms: number): Date => {
  const ret = new Date(d);
  const currentMS = ret.getUTCMilliseconds();
  ret.setUTCMilliseconds(currentMS + ms);
  return ret;
};

/**
 * Whether or not two dates are the same UTC date
 */
export const isSameDate = (a: Date, b: Date): boolean => {
  const Y1 = a.getUTCFullYear();
  const M1 = a.getUTCMonth();
  const D1 = a.getUTCDate();

  const Y2 = b.getUTCFullYear();
  const M2 = b.getUTCMonth();
  const D2 = b.getUTCDate();

  return Y1 === Y2 && M1 === M2 && D1 === D2;
};

/**
 * converts a date into a string mmddyy
 * @param d date object
 * @returns String of MMDDYY in UTC. Month is 1 indexed
 */
export const mmddyy = (d: Date): string => {
  return (
    padZeros(d.getUTCMonth() + 1, 2) +
    padZeros(d.getUTCDate(), 2) +
    d.getUTCFullYear().toString().substring(2)
  );
};
