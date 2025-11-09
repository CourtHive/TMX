import { numericValidator } from './numericValidator';

export const numericRange = (min: number, max: number) => (value: string | number): boolean => {
  return numericValidator(value) && Number(value) >= min && Number(value) <= max;
};
