import { utilities } from 'tods-competition-factory';

export function timeFormat(time) {
  return time ? utilities.dateTime.convertTime(time) : '';
}
