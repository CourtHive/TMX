import { utilities } from 'tods-competition-factory';

export function timeFormat(time, militaryTime) {
  return time ? utilities.dateTime.convertTime(time, militaryTime) : '';
}

export function timeStringToSeconds(timeString) {
  const a = timeFormat(timeString, true).split(':');
  return +a[0] * 60 * 60 + +a[1] * 60 + (+a[2] || 0);
}

export function zeroPad(number) {
  return number.toString()[1] ? number : '0' + number;
}
export function secondsToTimeString(seconds, nextHour) {
  let hours = Math.floor(seconds / (60 * 60));
  let minutes = Math.floor((seconds - hours * (60 * 60)) / 60);
  if (nextHour) {
    minutes = 0;
    hours += 1;
    if (hours > 23) hours = 0;
  }
  return `${zeroPad(hours)}:${zeroPad(minutes)}`;
}
