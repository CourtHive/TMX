export function isFunction(fx) {
  return typeof fx === 'function';
}
export function isString(item) {
  return typeof item === 'string';
}
export function isArray(item) {
  return Array.isArray(item);
}
export function isObject(item) {
  return typeof item === 'object' && !Array.isArray(item);
}
