export function getParent(elem, className): { parent: HTMLElement; index: number } {
  const index = Array.from(elem.classList).indexOf(className);
  const parent = index >= 0 ? elem : findAncestor(elem, className);
  return { parent, index: index >= 0 ? index : -1 };
}

export function findAncestor(el, className): HTMLElement | null {
  if (!el) return null;
  if (el.classList && Array.from(el.classList).indexOf(className) >= 0) return el;
  while (el.parentNode) {
    el = el.parentNode;
    if (el.classList && Array.from(el.classList).indexOf(className) >= 0) return el;
  }
  return null;
}

export function getTargetAttribute(el, className, attribute): string {
  const ancestor = findAncestor(el, className);
  return ancestor?.getAttribute(attribute) || '';
}

export function getChildrenByClassName(elem, className): HTMLElement[] {
  const matches: HTMLElement[] = [];

  function traverse(node) {
    node.childNodes.forEach((child) => {
      if (child.childNodes.length > 0) traverse(child);
      if (child.classList && Array.from(child.classList).indexOf(className) >= 0) matches.push(child);
    });
  }

  traverse(elem);

  return matches;
}
