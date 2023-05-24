import { padZeros } from "./formatting";

/**
 * Sets the time to 0:0:0 UTC for a given date
 * @param d date
 * @returns date with cleared 0:0:0:0 time
 */
export const midnightZulu = (d: Date): Date => {
  d.setUTCHours(0);
  d.setUTCMinutes(0);
  d.setUTCSeconds(0);
  d.setUTCMilliseconds(0);
  return d;
};

const getMS = (d: Date): number => {
  // TODO: isn't this just Date.prototype.getTime()?
  const Y = d.getUTCFullYear();
  const M = d.getUTCMonth();
  const D = d.getUTCDate();
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const s = d.getUTCSeconds();
  const ms = d.getUTCMilliseconds();
  return Date.UTC(Y, M, D, h, m, s, ms);
};

/**
 * Get the number of milliseconds between two dates, equivalent to `a - b`
 */
export const diff = (a: Date, b: Date): number => {
  return getMS(a) - getMS(b);
};

/**
 * Advance a Date by some number of milliseconds
 */
export const add = (d: Date, ms: number): Date => {
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
