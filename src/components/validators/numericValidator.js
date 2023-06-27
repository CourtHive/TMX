import { utilities } from 'tods-competition-factory';

export function numericValidator(value) {
  return utilities.isConvertableInteger(value);
}
