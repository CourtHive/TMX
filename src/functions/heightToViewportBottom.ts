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
export function fillToViewportBottom(
  element: HTMLElement,
  options: {
    gap?: number;
    min?: number;
    /** `minHeight` for an element that must still grow with its content (the venues table's expanding rows) */
    property?: 'height' | 'minHeight';
  } = {},
): () => void {
  const { property = 'height', ...heightOptions } = options;
  let frame = 0;
  const release = () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', fit);
  };
  // An element taken off the page by a navigation that never called the cleanup lets go on the next resize
  function fit() {
    if (!element.isConnected) return release();
    const top = element.getBoundingClientRect().top + window.scrollY;
    element.style[property] =
      `${heightToViewportBottom({ top, viewportHeight: window.innerHeight, ...heightOptions })}px`;
  }
  fit();
  // the chrome above can settle a frame later (control bars are rendered after the view)
  frame = requestAnimationFrame(fit);
  window.addEventListener('resize', fit);
  return release;
}

/**
 * Keep a Tabulator table sized from its top to the bottom of the window, as the window resizes — through
 * `setHeight`, which Tabulator needs to lay its rows out again (a style height alone leaves its body the old size).
 * Returns the cleanup; a table taken off the page lets go on the next resize.
 *
 * Replaces `innerHeight × tableHeightMultiplier` where the chrome above a table is fixed in pixels: a fraction left a
 * band of background under the table on a tall window and pushed the table's footer off a short one (CA 2026-11-08).
 */
export function fitTableToViewportBottom(
  table: { setHeight?: (height: number) => void; element?: HTMLElement; on?: (event: string, cb: () => void) => void },
  element: HTMLElement,
  options: { gap?: number; min?: number } = {},
): () => void {
  let frame = 0;
  let last = 0;
  let chrome: ResizeObserver | undefined;
  const release = () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', fit);
    chrome?.disconnect();
  };
  function fit() {
    if (!element.isConnected) return release();
    const top = element.getBoundingClientRect().top + window.scrollY;
    const height = heightToViewportBottom({ top, viewportHeight: window.innerHeight, ...options });
    if (height === last) return;
    last = height;
    // setHeight redraws the rows; keep the reader where they were (a refit a frame after a scroll undid it, journey 87)
    const holder = element.querySelector<HTMLElement>('.tabulator-tableholder');
    const scrollTop = holder?.scrollTop ?? 0;
    table.setHeight?.(height);
    if (holder && scrollTop) holder.scrollTop = scrollTop;
  }
  fit();
  // the chrome above can settle a frame later (control bars and summary bars are rendered after the table)
  frame = requestAnimationFrame(fit);
  window.addEventListener('resize', fit);
  // A table rebuilt into the same anchor (every visit to its tab, every participants re-render) leaves the anchor on
  // the page, so the disconnect check above never lets go: release with the table, or each rebuild adds a listener
  // that resizes a destroyed table.
  table.on?.('tableDestroyed', release);
  // Tabulator gives its rows what the height leaves after the header and footer as they measured when it laid out, and
  // does not look again when they change. A footer of chips that wraps to a second line and then unwraps (the
  // participants footer hides its empty chips a frame after it is built) left the rows short, and the table's content
  // sat centred inside it, a band above the header and another under the footer. Lay out again when they change.
  if (typeof ResizeObserver !== 'undefined') {
    let sizes = '';
    chrome = new ResizeObserver(() => {
      const next = [...element.children]
        .filter((child) => !child.classList.contains('tabulator-tableholder'))
        .map((child) => Math.round(child.getBoundingClientRect().height))
        .join();
      if (next === sizes) return;
      sizes = next;
      // the first report counts too: the footer may have settled between the fit and the observer starting
      if (last) table.setHeight?.(last);
    });
    for (const child of element.children) {
      if (!child.classList.contains('tabulator-tableholder')) chrome.observe(child);
    }
  }
  return release;
}
