import { t } from 'i18n';

const SLOT = '.tmx-demo-clock-slot';
const ACTIVE_HOST = 'tmx-demo-clock-host--active';

/** Existing page bars offer a slot; a grid spacer keeps its original layout when inactive. */
export function createDemoClockSlot(bar: HTMLElement, { spacer = false, workspace = false } = {}): HTMLElement {
  bar.classList.add('tmx-demo-clock-host');
  if (workspace) bar.dataset.clockWorkspace = 'true';
  const slot = document.createElement('div');
  slot.className = spacer ? 'tmx-demo-clock-slot tmx-demo-clock-slot--spacer' : 'tmx-demo-clock-slot';
  slot.style.flex = '1';
  slot.style.display = spacer ? 'flex' : 'none';
  return slot;
}

/** Follow page-owned bars across rerenders. Only pages without a bar receive a fallback dock. */
export function mountDemoClock(panel: HTMLElement): () => void {
  const shell = document.querySelector<HTMLElement>('.app_shell') ?? document.body;
  let fallback: HTMLElement | undefined;
  let activeHost: HTMLElement | undefined;
  let activeSlot: HTMLElement | undefined;
  let frame: number | undefined;
  const fittedTables = new Set<HTMLElement>();
  const tableHeight = '--tmx-demo-clock-table-height';

  const releaseSlot = () => {
    if (activeSlot && !activeSlot.classList.contains('tmx-demo-clock-slot--spacer')) activeSlot.style.display = 'none';
  };

  const releaseTableSpace = () => {
    for (const table of fittedTables) {
      delete table.dataset.demoClockFit;
      table.style.removeProperty(tableHeight);
    }
    fittedTables.clear();
  };

  const reserveTableSpace = (dock: HTMLElement) => {
    // Table heights are viewport-based. Use their actual position so the dock occupies free
    // space beneath them instead of covering rows, including on short windows.
    for (const table of shell.querySelectorAll<HTMLElement>('.tabulator')) {
      if (!table.getClientRects().length || table.parentElement?.closest('.tabulator')) continue;
      const height = `${Math.max(120, globalThis.innerHeight - table.getBoundingClientRect().top - dock.offsetHeight)}px`;
      if (table.style.getPropertyValue(tableHeight) !== height) table.style.setProperty(tableHeight, height);
      table.dataset.demoClockFit = 'true';
      fittedTables.add(table);
    }
  };

  const place = () => {
    frame = undefined;
    const slots = [...shell.querySelectorAll<HTMLElement>(SLOT)];
    const slot =
      slots.find(
        (element) => !element.parentElement?.dataset.clockWorkspace && element.parentElement?.getClientRects().length,
      ) ??
      slots.find(
        (element) =>
          element.parentElement?.dataset.clockWorkspace && element.parentElement.parentElement?.getClientRects().length,
      );
    const host = slot?.parentElement;
    if (activeSlot !== slot) {
      releaseSlot();
      activeSlot = slot;
      if (slot) slot.style.display = 'flex';
    }
    if (activeHost !== host) {
      activeHost?.classList.remove(ACTIVE_HOST);
      activeHost = host ?? undefined;
      activeHost?.classList.add(ACTIVE_HOST);
    }
    if (slot) {
      if (fittedTables.size) releaseTableSpace();
      if (panel.parentElement !== slot) slot.append(panel);
      fallback?.remove();
      fallback = undefined;
      delete document.documentElement.dataset.tmxDemoClockDock;
    } else {
      if (!fallback) {
        fallback = document.createElement('footer');
        fallback.className = 'tmx-demo-clock-bar';
        fallback.setAttribute('aria-label', t('demoClock.bottomBar'));
        shell.append(fallback);
      }
      if (panel.parentElement !== fallback) fallback.append(panel);
      document.documentElement.dataset.tmxDemoClockDock = 'true';
      reserveTableSpace(fallback);
    }
  };
  // Pages show and hide their bars through inline style, so style changes are watched; placement runs at most once per
  // animation frame however many mutations arrive.
  const schedulePlacement = () => {
    frame ??= globalThis.requestAnimationFrame(place);
  };
  const observer = new MutationObserver(schedulePlacement);
  observer.observe(shell, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  globalThis.addEventListener('resize', schedulePlacement);
  place();
  return () => {
    observer.disconnect();
    globalThis.removeEventListener('resize', schedulePlacement);
    if (frame !== undefined) globalThis.cancelAnimationFrame(frame);
    activeHost?.classList.remove(ACTIVE_HOST);
    releaseSlot();
    panel.remove();
    fallback?.remove();
    releaseTableSpace();
    delete document.documentElement.dataset.tmxDemoClockDock;
  };
}
