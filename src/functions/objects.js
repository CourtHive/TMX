export function createMap(objectArray, attribute) {
  if (!Array.isArray(objectArray)) return {};

  return Object.assign(
    {},
    ...(objectArray ?? [])
      .filter(isObject)
      .map((obj) => {
        return (
          obj[attribute] && {
            [obj[attribute]]: obj
          }
        );
      })
      .filter(Boolean)
  );
}

export function isObject(obj) {
  return typeof obj === 'object';
}
