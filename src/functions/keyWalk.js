export function keyWalk(valuesObject, optionsObject) {
  if (!valuesObject || !optionsObject) return;
  let vKeys = Object.keys(valuesObject);
  let oKeys = Object.keys(optionsObject);
  for (let key of vKeys) {
    if (oKeys.indexOf(key) >= 0) {
      let oo = optionsObject[key];
      let vo = valuesObject[key];
      if (typeof oo == 'object' && typeof vo !== 'function' && oo.constructor !== Array) {
        keyWalk(valuesObject[key], optionsObject[key]);
      } else {
        optionsObject[key] = valuesObject[key];
      }
    }
  }
}
