/**
 * The docked (bottom) catalog keeps the tallest height it has shown (CA 2026-11-22).
 *
 * The dock's height is `auto` between a 180px floor and 45vh (courthive-components `schedule-page.css`), so it
 * followed whatever it held. With cards taller than the floor, collapsing a group, an empty tab, or the Scheduled
 * tab's cards sitting 2px shorter than the Unscheduled tab's moved the boundary between the grid and the catalog, and
 * the grid jumped. Holding the tallest height as a floor stops that, while a still taller card can still grow it.
 *
 * Held per session, so rebuilding the grid on a date change does not start the dock over. A placement change or a
 * window resize releases it: the 45vh cap would otherwise lose to a floor measured against a taller window.
 */
let tallest = 0;
let observer: ResizeObserver | undefined;
let dock: HTMLElement | undefined;
let onWindowResize: (() => void) | undefined;

function hold(): void {
  if (!dock) return;
  const height = dock.getBoundingClientRect().height;
  if (height <= tallest + 0.5) return;
  tallest = height;
  dock.style.minHeight = `${Math.ceil(height)}px`;
}

/** Forget the held height; the dock measures again from its own content. */
export function resetCatalogDockHeight(): void {
  tallest = 0;
  if (dock) dock.style.minHeight = '';
  requestAnimationFrame(hold);
}

/** Hold `region`'s tallest height while `docked`; release it otherwise. Replaces any earlier hold. */
export function holdCatalogDockHeight(region: HTMLElement | null | undefined, docked: boolean): void {
  releaseCatalogDockHeight({ keepHeight: true });
  if (!region || !docked) {
    tallest = 0;
    return;
  }
  dock = region;
  if (tallest) dock.style.minHeight = `${Math.ceil(tallest)}px`;
  observer = new ResizeObserver(hold);
  observer.observe(dock);
  onWindowResize = resetCatalogDockHeight;
  window.addEventListener('resize', onWindowResize);
}

export function releaseCatalogDockHeight(options?: { keepHeight?: boolean }): void {
  observer?.disconnect();
  observer = undefined;
  if (onWindowResize) window.removeEventListener('resize', onWindowResize);
  onWindowResize = undefined;
  if (dock) dock.style.minHeight = '';
  dock = undefined;
  if (!options?.keepHeight) tallest = 0;
}
