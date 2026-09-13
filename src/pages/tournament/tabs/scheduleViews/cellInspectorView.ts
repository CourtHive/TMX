/**
 * Schedule2 — the Inspector, inside the court grid's cell popover.
 *
 * The cell popover answers "what do I want to DO to this matchUp" — set a time,
 * call it, score it, take it off the schedule. It has never answered "should
 * this be happening at all", which is what readiness and rest are for, and which
 * is a question an operator is more likely to have while looking at a court than
 * while looking at the catalog.
 *
 * ── Why not just select it into the sidebar Inspector ──
 *
 * That was the cheaper option and it half-works. The store clears the selection
 * whenever the selected matchUp leaves the catalog (`schedulePageStore`), and a
 * matchUp on another date, or one hidden by the completed-filter, is not in it —
 * so the panel would silently deselect for exactly the matchUps an operator is
 * most likely to be interrogating. The popover owes nothing to the catalog.
 *
 * ── What it shows, and what it deliberately does not ──
 *
 * The same sections TMX contributes to the sidebar Inspector — actions, rest,
 * readiness — under a compact header. Not the component's key/value rows: the
 * popover is anchored to the cell that already says which court and which time,
 * and repeating that would spend the popover's height on what the operator is
 * pointing at.
 *
 * For the same reason the selection handed to `renderInspectorSections` carries
 * no court: the "on the grid — Court 3" note exists to explain a selection that
 * has vanished from the sidebar lists, and there is nothing to explain to
 * somebody whose pointer is on the cell.
 */

import { renderInspectorSections } from './inspectorReadiness';
import { t } from 'i18n';

/** Room for rest rows and readiness sentences; the pill menu's 280px crops both. */
export const INSPECTOR_POPOVER_WIDTH = 400;

function backButton(label: string, onBack: () => void): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.style.cssText = [
    'background: transparent',
    'border: 0',
    'color: inherit',
    'padding: 0 4px 0 0',
    'cursor: pointer',
    'font-size: 0.8125rem',
    'display: inline-flex',
    'align-items: center',
  ].join('; ');
  button.title = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
  button.addEventListener('click', onBack);
  return button;
}

/**
 * The popover's Inspector body.
 *
 * Returns null when there is nothing to show — a matchUp no longer in the
 * tournament — so the caller can leave the pill menu up rather than swapping to
 * an empty panel.
 */
export function buildCellInspectorView(
  matchUpId: string,
  viewedDate: string | null,
  onBack: () => void,
): HTMLElement | null {
  // Only the id: see the header note on why no court is passed.
  const sections = renderInspectorSections({ matchUpId }, viewedDate);
  if (!sections) return null;

  const view = document.createElement('div');
  view.className = 'tmx-cell-inspector';
  view.style.cssText = 'padding: 10px; min-width: 260px; font-size: 0.75rem;';

  const header = document.createElement('div');
  header.style.cssText = 'display: flex; align-items: center; gap: 4px; margin-bottom: 6px;';
  header.appendChild(backButton(t('schedule.inspector.back'), onBack));

  const title = document.createElement('div');
  title.style.cssText = [
    'font-size: 0.5625rem',
    'font-weight: 700',
    'text-transform: uppercase',
    'letter-spacing: 0.5px',
    'color: var(--sp-muted, var(--tmx-muted, #9ca3af))',
  ].join('; ');
  title.textContent = t('schedule.inspector.heading');
  header.appendChild(title);

  view.appendChild(header);
  view.appendChild(sections);
  return view;
}
