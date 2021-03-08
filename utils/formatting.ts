/**
 * Return a zero padded string of a number
 */
export function padZeros(num: number, size: number): string {
  let s = num.toString();
  return s.padStart(size, "0");
}

/**
 * Calculates seconds into day (appSeconds) of any isoString timestamp
 */
export function appSecondsFromDateString(dateStringParam: string): number {
  const isoString = isoStringFromAnyDateString(dateStringParam);
  const startOfDay = new Date(`${isoString.split("T")[0]}T00:00:00Z`);
  const isoDate = new Date(isoString);
  return (isoDate.getTime() - startOfDay.getTime()) / 1000;
}

/**
 * Formats any isoString timestamp into hh:mm:ss
 */
export function hhmmssFromDateString(dateStringParam: string): string {
  if (dateStringParam === "") {
    return "";
  }
  const isoString = isoStringFromAnyDateString(dateStringParam);
  const tempDate = new Date(isoString);
  const hh = padZeros(tempDate.getUTCHours(), 2);
  const mm = padZeros(tempDate.getUTCMinutes(), 2);
  const ss = padZeros(tempDate.getUTCSeconds(), 2);
  return `${hh}:${mm}:${ss}`;
}

/**
 * Formats any appSeconds value into hh:mm:ss equivalent
 */
export function hhmmssFromSeconds(secondsParam: number): string {
  var hours = Math.abs(Math.trunc(secondsParam / 3600));
  var minutes = (Math.abs(Math.trunc(secondsParam / 60)) % 60) % 60;
  var seconds = Math.abs(Math.trunc(secondsParam)) % 60;
  seconds = Math.floor(seconds);
  var timeStr = padZeros(hours, 2) + ":" + padZeros(minutes, 2) + ":" + padZeros(seconds, 2);
  if (secondsParam < 0) {
    timeStr = "-" + timeStr;
  }
  return timeStr;
}

/**
 * Formats any isoString timestamp into yyyy-mm-dd
 */
export function shortdateFromDateString(dateString: string): string {
  if (dateString === "") {
    return "";
  }
  dateString = isoStringFromAnyDateString(dateString);
  const tempDate = new Date(dateString);
  return (
    tempDate.getUTCFullYear() +
    "-" +
    padZeros(tempDate.getUTCMonth() + 1, 2) +
    "-" +
    padZeros(tempDate.getUTCDate(), 2)
  );
}

/**
 * Takes a date string and returns an isoString, throwing an error if conversion is impossible
 */
function isoStringFromAnyDateString(dateString: string): string {
  const tempDate = new Date(dateString); // works with ISO and UTC date strings
  if (isNaN(tempDate.valueOf())) {
    throw new Error("The date string couldn't be converted into a Date");
  }
  return tempDate.toISOString(); // guaranteed to have an ISO string. safe to string parse it
}
