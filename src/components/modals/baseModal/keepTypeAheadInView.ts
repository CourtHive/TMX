/**
 * Keep a type-ahead's suggestion list inside the modal it opens in.
 *
 * The modal body scrolls (`.chc-modal-body { overflow-y: auto }`), and Awesomplete draws its list absolutely
 * below the input, so a list longer than the room under the input was cut off by the body's edge, under the
 * footer (reported on "Select provider", 2026-10-11). While a list is open, its height is added to the
 * container's bottom padding, so the body grows to hold it (up to the dialog's own max height, then it
 * scrolls); when the list closes, the padding is put back. One listener per modal: Awesomplete's open and
 * close events bubble.
 */
const OPEN = 'awesomplete-open';
const CLOSE = 'awesomplete-close';

export function keepTypeAheadInView(container: HTMLElement): void {
  const original = container.style.paddingBottom;

  container.addEventListener(OPEN, (event) => {
    const list = (event.target as HTMLElement | null)?.parentElement?.querySelector<HTMLElement>('ul[role="listbox"]');
    if (list) container.style.paddingBottom = `calc(${original || '0px'} + ${list.offsetHeight}px)`;
  });
  container.addEventListener(CLOSE, () => {
    container.style.paddingBottom = original;
  });
}
