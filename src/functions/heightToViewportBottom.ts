/**
 * The height that takes an element from where it starts down to the bottom of the window.
 *
 * Measured, never written as `calc(100vh - <chrome>px)`: the chrome above an element (header, tabs, control bars,
 * notices) changes with the page, and a hard-coded allowance either leaves a strip of background under the element or
 * pushes it off the screen (journey 103). `top` is the element's offset from the top of the DOCUMENT, so a page that
 * is scrolled when this is asked still gets the height it would have at the top.
 */
export function heightToViewportBottom({
  top,
  viewportHeight,
  gap = 0,
  min = 320,
}: {
  top: number;
  viewportHeight: number;
  /** Room to leave under the element, e.g. for a page margin. */
  gap?: number;
  /** The least the element gets, however little window is left below it. */
  min?: number;
}): number {
  return Math.max(min, Math.floor(viewportHeight - top - gap));
}

/**
 * Keep an element sized from its top to the bottom of the window, as the window resizes. Returns the cleanup.
 */
export function fillToViewportBottom(element: HTMLElement, options: { gap?: number; min?: number } = {}): () => void {
  let frame = 0;
  const release = () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', fit);
  };
  // An element taken off the page by a navigation that never called the cleanup lets go on the next resize
  function fit() {
    if (!element.isConnected) return release();
    const top = element.getBoundingClientRect().top + window.scrollY;
    element.style.height = `${heightToViewportBottom({ top, viewportHeight: window.innerHeight, ...options })}px`;
  }
  fit();
  // the chrome above can settle a frame later (control bars are rendered after the view)
  frame = requestAnimationFrame(fit);
  window.addEventListener('resize', fit);
  return release;
}
