import { tools } from 'tods-competition-factory';

export function numericValidator(value: string | number): boolean {
  return tools.isConvertableInteger(value) && parseInt(value.toString()) >= 0;
}
