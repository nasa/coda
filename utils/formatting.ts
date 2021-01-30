import { TimingData } from "store/videos";

/**
 * Return a zero padded string of a number
 */
export function padZeros(num: number, size: number): string {
  let s = num.toString();
  return s.padStart(2, "0");
}

/**
 * Convert the number of seconds to a formatted HH:MM:SS string
 */
export function secondsToTimeStr(totalSeconds: number): string {
  var hours = Math.abs(Math.round(totalSeconds / 3600));
  var minutes = (Math.abs(Math.round(totalSeconds / 60)) % 60) % 60;
  var seconds = Math.abs(Math.round(totalSeconds)) % 60;
  seconds = Math.floor(seconds);
  var timeStr = padZeros(hours, 2) + ":" + padZeros(minutes, 2) + ":" + padZeros(seconds, 2);
  if (totalSeconds < 0) {
    timeStr = "-" + timeStr.substr(1); //change timeStr to negative, replacing leading zero in hours with "-"
  }
  return timeStr;
}

/**
 * Simple conversion of seconds to HH:MM. Will prepend a negative sign if necessary */
export function secondsToHHMM(seconds: number): string {
  const hours = Math.abs(Math.round(seconds / 3600));
  const minutes = (Math.abs(Math.round(seconds / 60)) % 60) % 60;
  let timeStr = padZeros(hours, 2) + ":" + padZeros(minutes, 2);
  if (seconds < 0) {
    timeStr = "-" + timeStr;
  }
  return timeStr;
}

export function secondsToZuluString(seconds: number, timingData: TimingData): string {
  var zuluDate = secondsToZuluDate(seconds, timingData);
  var temp = zuluDate.toISOString().split("T")[1].split(":");
  return temp[0] + ":" + temp[1] + ":" + temp[2].split(".")[0] + "Z";
}

function secondsToZuluDate(seconds: number, timingData: TimingData): Date {
  return new Date(timingData.video_earliestStart.getTime() + seconds * 1000);
}

function zuluDateToSeconds(zuluDate: Date, timingData: TimingData): number {
  return (zuluDate.getTime() - timingData.video_earliestStart.getTime()) / 1000;
}

export function timeFromZuluDate(zuluDate: Date): string {
  const hh = padZeros(zuluDate.getUTCHours(), 2);
  const mm = padZeros(zuluDate.getUTCMinutes(), 2);
  const ss = padZeros(zuluDate.getUTCSeconds(), 2);
  return `${hh}:${mm}:${ss}`;
}

export function shortdateFromZuluDate(zuluDate: Date): string {
  return (
    padZeros(zuluDate.getUTCFullYear(), 2) +
    "-" +
    padZeros(zuluDate.getUTCMonth() + 1, 2) +
    "-" +
    padZeros(zuluDate.getUTCDate(), 2)
  );
}

export function dateAsCanonicalString(d: Date): string {
  const Y = d.getUTCFullYear();
  const M = d.getUTCMonth();
  const D = d.getUTCDate();
  return `${Y}/${M}/${D}`;
}
