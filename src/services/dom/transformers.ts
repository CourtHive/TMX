export function removeAllChildNodes(parent: HTMLElement | null): void {
  if (!parent) return;

  while (parent.firstChild) {
    parent.removeChild(parent.firstChild);
  }
}
