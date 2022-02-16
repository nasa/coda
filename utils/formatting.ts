import { isNaN } from "lodash";
import { add } from "store/playhead";

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
 * Formats any appSeconds value into hh:mm:ss.mmm equivalent
 */
export function hhmmssmmmFromSeconds(secondsParam: number): string {
  const hours = Math.abs(Math.trunc(secondsParam / 3600));
  const minutes = (Math.abs(Math.trunc(secondsParam / 60)) % 60) % 60;
  let seconds = Math.abs(Math.trunc(secondsParam)) % 60;
  const milliseconds = (secondsParam - Math.trunc(secondsParam)).toFixed(3);
  var timeStr =
    padZeros(hours, 2) +
    ":" +
    padZeros(minutes, 2) +
    ":" +
    padZeros(seconds, 2) +
    "." +
    milliseconds.toString().substr(2);
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
export function isoStringFromAnyDateString(dateString: string): string {
  const tempDate = new Date(dateString); // works with ISO and UTC date strings
  if (isNaN(tempDate.valueOf())) {
    throw new Error("The date string couldn't be converted into a Date");
  }
  return tempDate.toISOString(); // guaranteed to have an ISO string. safe to string parse it
}

export function getPlayheadISOString(playheadDate: string, playheadSeconds: number) {
  const date = new Date(playheadDate);
  const withSeconds = add(date, playheadSeconds * 1000);
  return withSeconds.toISOString();
}

/** Nicely format an IO collections string for display */
export function cleanCollectionsString(colStr: string) {
  const fullTree = colStr.split("|");

  let cleaned = fullTree[fullTree.length - 1];
  cleaned = cleaned.replace(fullTree[1], "");
  if (fullTree[2]?.includes("Earth Obs")) {
    cleaned = fullTree[2].replace(fullTree[1], "") + " " + cleaned;
  }
  if (cleaned === "Photo") {
    cleaned = fullTree[2].replace(fullTree[1], "");
  }
  return cleaned;
}

/** Get a formatted pseudo-julian date */
export function getJulianDate(date: Date): string {
  const year = date.getUTCFullYear();

  // borrowed from https://stackoverflow.com/a/8619946
  const start = new Date(Date.UTC(year, 0, 0));
  const msDiff = date.valueOf() - start.valueOf();
  const msOneDay = 1000 * 60 * 60 * 24;
  const jd = Math.floor(msDiff / msOneDay);

  return `${year}/${jd}`;
}

/** Cleans EVA titles from the wiki */
export function cleansEVATitleFromWiki(title: string, evaName: string) {
  let displayTitle = title.replace("US EVA ", "");
  const evaNum = evaName.split(" ")[2];
  displayTitle = title.replace(`${evaNum} `, "");
  displayTitle = displayTitle === evaNum ? "" : displayTitle;
  displayTitle =
    displayTitle.substring(0, 1) === "(" ? displayTitle.replace("(", "") : displayTitle;
  displayTitle =
    displayTitle.substring(displayTitle.length - 1) === ")"
      ? displayTitle.replace(")", "")
      : displayTitle;
  return displayTitle;
}
