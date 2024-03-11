import { tools } from 'tods-competition-factory';

export function dateValidator(value) {
  return tools.dateTime.dateValidation.test(value);
}
