/**
 * Return a zero padded string of a number
 */
export function padZeros(num: number, size: number): string {
  let s = num + "";
  while (s.length < size) s = "0" + s;
  return s;
}

/**
 * Convert the number of seconds to a formatted HH:MM:SS string
 */
export function secondsToTimeStr(totalSeconds: number): string {
  var hours = Math.abs(Math.round(totalSeconds / 3600));
  var minutes = (Math.abs(Math.round(totalSeconds / 60)) % 60) % 60;
  var seconds = Math.abs(Math.round(totalSeconds)) % 60;
  seconds = Math.floor(seconds);
  var timeStr =
    padZeros(hours, 2) +
    ":" +
    padZeros(minutes, 2) +
    ":" +
    padZeros(seconds, 2);
  if (totalSeconds < 0) {
    timeStr = "-" + timeStr.substr(1); //change timeStr to negative, replacing leading zero in hours with "-"
  }
  return timeStr;
}

export function secondsToZuluString(seconds, gTimingData) {
  var zuluDate = secondsToZuluDate(seconds, gTimingData);
  var temp = zuluDate.toISOString().split('T')[1].split(':');
  return temp[0] + ":" + temp[1] + ":" + temp[2].split('.')[0] + 'Z';
}

function secondsToZuluDate(seconds, gTimingData) {
    return new Date(gTimingData.video_earliestStart.getTime() + seconds * 1000);
}

function zuluDateToSeconds(zuluDate, gTimingData) {
    return (zuluDate.getTime() - gTimingData.video_earliestStart.getTime()) / 1000;
}

function timeFromZuluDate(zuluDate) {
    return padZeros(zuluDate.getUTCHours(), 2) + ":" + padZeros(zuluDate.getUTCMinutes(), 2) + ":" + padZeros(zuluDate.getUTCSeconds(), 2);
}

function shortdateFromZuluDate(zuluDate) {
    return padZeros(zuluDate.getUTCFullYear(), 2) + "-" + padZeros(zuluDate.getUTCMonth() + 1, 2) + "-" + padZeros(zuluDate.getUTCDate(), 2);
}