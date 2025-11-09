export const nameValidator = (minLength: number, maxLength?: number) => (value: string): boolean =>
  value?.trim().length >= minLength && (!maxLength || value?.trim().length <= maxLength);
