export function isFunction(fx: any): fx is Function {
  return typeof fx === 'function';
}
export function isString(item: any): item is string {
  return typeof item === 'string';
}
export function isArray(item: any): item is any[] {
  return Array.isArray(item);
}
export function isObject(item: any): item is object {
  return typeof item === 'object' && !Array.isArray(item);
}
