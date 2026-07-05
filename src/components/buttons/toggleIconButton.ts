/**
 * Pressed/unpressed icon toggle button — used wherever a small FontAwesome
 * icon should switch a binary view state (catalog show/hide, minimap
 * show/hide, active-strip show/hide). Matches the styling in
 * `scheduleViews/gridHeaderActions.ts`; lifted out so other call sites can
 * reuse it without duplicating the styling tokens.
 */

const ARIA_PRESSED = 'aria-pressed';

// Tinted accent fill when pressed (icon-density-agnostic — both
// fa-table-columns and fa-grip-lines read as "on" the same way).
export const TOGGLE_BG_PRESSED = 'rgba(59, 130, 246, 0.18)';
export const TOGGLE_BG_UNPRESSED = 'transparent';

const BORDER_RADIUS_6 = 'border-radius: 6px';
const BORDER_PRIMARY = 'border: 1px solid var(--tmx-border-primary)';
const COLOR_PRIMARY = 'color: var(--tmx-color-primary)';

export const TOGGLE_BTN_BASE_STYLE = [
  'font-size: 0.75rem',
  'padding: 4px 8px',
  BORDER_RADIUS_6,
  BORDER_PRIMARY,
  COLOR_PRIMARY,
  'cursor: pointer',
  'display: inline-flex',
  'align-items: center',
  'gap: 4px',
  'transition: background 0.15s, opacity 0.15s, color 0.15s',
].join('; ');

/** Circular variant — matches the height of its tallest flex sibling (a Bulma
 *  is-toggle tab pill in practice) via `align-self: stretch`. The width is
 *  mirrored to that computed height by `buildToggleIconButton` after mount
 *  via ResizeObserver, since `aspect-ratio: 1` on an inline-flex item with
 *  intrinsic icon content didn't reliably derive width from the stretched
 *  height across browsers. */
export const TOGGLE_BTN_CIRCLE_STYLE = [
  'font-size: 0.75rem',
  'align-self: stretch',
  'padding: 0',
  'border-radius: 50%',
  BORDER_PRIMARY,
  COLOR_PRIMARY,
  'cursor: pointer',
  'display: inline-flex',
  'align-items: center',
  'justify-content: center',
  'transition: background 0.15s, opacity 0.15s, color 0.15s',
].join('; ');

export interface ToggleIconButtonParams {
  icon: string;
  pressed: boolean;
  titleOn: string;
  titleOff: string;
  onChange: (pressed: boolean) => void;
  /** `'pill'` (default) matches the schedule2 catalog toggle. `'circle'`
   *  matches the height of a Bulma `is-toggle` tab pill — use this when
   *  the toggle lives beside a (Cards | Table)-style tab group. */
  shape?: 'pill' | 'circle';
}

export function buildToggleIconButton(params: ToggleIconButtonParams): HTMLButtonElement {
  const { icon, pressed: initial, titleOn, titleOff, onChange, shape = 'pill' } = params;
  const btn = document.createElement('button');
  btn.style.cssText = shape === 'circle' ? TOGGLE_BTN_CIRCLE_STYLE : TOGGLE_BTN_BASE_STYLE;
  btn.innerHTML = `<i class="fa-solid ${icon}" style="font-size: 0.75rem;"></i>`;
  applyToggleState(btn, initial, titleOn, titleOff);
  btn.addEventListener('click', () => {
    const wasPressed = btn.getAttribute(ARIA_PRESSED) === 'true';
    const next = !wasPressed;
    applyToggleState(btn, next, titleOn, titleOff);
    onChange(next);
  });
  if (shape === 'circle') {
    // Mirror the stretched height onto width so the toggle stays circular
    // regardless of the sibling tab pill's rendered size. Setting width
    // doesn't change height, so ResizeObserver settles after one pass.
    const syncDiameter = () => {
      const h = btn.offsetHeight;
      if (h && btn.style.width !== `${h}px`) btn.style.width = `${h}px`;
    };
    new ResizeObserver(syncDiameter).observe(btn);
  }
  return btn;
}

export function applyToggleState(
  btn: HTMLButtonElement,
  pressed: boolean,
  titleOn: string,
  titleOff: string,
): void {
  btn.setAttribute(ARIA_PRESSED, pressed ? 'true' : 'false');
  btn.style.background = pressed ? TOGGLE_BG_PRESSED : TOGGLE_BG_UNPRESSED;
  btn.style.opacity = pressed ? '1' : '0.45';
  btn.title = pressed ? titleOn : titleOff;
}
