export function getParent(elem, className) {
  return Array.from(elem.classList).indexOf(className) >= 0 ? elem : findAncestor(elem, className);
}

export function findAncestor(el, className) {
  if (!el) return null;
  if (el.classList && Array.from(el.classList).indexOf(className) >= 0) return el;
  while (el.parentNode) {
    el = el.parentNode;
    if (el.classList && Array.from(el.classList).indexOf(className) >= 0) return el;
  }
  return null;
}

export function getChildrenByClassName(elem, className) {
  const matches = [];

  function traverse(node) {
    node.childNodes.forEach((child) => {
      if (child.childNodes.length > 0) traverse(child);
      if (child.classList && Array.from(child.classList).indexOf(className) >= 0) matches.push(child);
    });
  }

  traverse(elem);

  return matches;
}
