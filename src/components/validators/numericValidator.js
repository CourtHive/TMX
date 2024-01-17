import { tools } from 'tods-competition-factory';

export function numericValidator(value) {
  return tools.isConvertableInteger(value) && parseInt(value) >= 0;
}
