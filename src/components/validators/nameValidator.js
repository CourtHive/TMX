export const nameValidator = (minLength, maxLength) => (value) =>
  value.length >= minLength && (!maxLength || (maxLength && value.length <= maxLength));
