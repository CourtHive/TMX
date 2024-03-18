export const nameValidator = (minLength, maxLength) => (value) =>
  value?.trim().length >= minLength && (!maxLength || (maxLength && value?.trim().length <= maxLength));
