export function findParentByClassName(el, className) {
  if (!el) return null;
  if (el.className.includes(className)) return el;

  while (el.parentNode) {
    el = el.parentNode;
    if (el.className.includes(className)) return el;
  }

  return null;
}
