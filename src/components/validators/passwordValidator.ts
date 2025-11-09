export const passwordValidator = (value) => {
  const reg = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?\d)(?=.*?[#?!@$%^&*-]).{8,12}$/;
  return reg.test(value);
};
