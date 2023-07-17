import { numericValidator } from './numericValidator';

export const numericRange = (min, max) => (value) => {
  return numericValidator(value) && value >= min && value <= max;
};
