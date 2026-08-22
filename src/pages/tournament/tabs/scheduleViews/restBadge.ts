/**
 * Schedule2 — compact rest badge for catalog matchUp cards.
 *
 * The Inspector's Rest section answers the question in full, but it costs the
 * operator a selection: they have to click a card to learn whether the players
 * on it are rested. The decision the badge serves — *which of these do I call
 * next?* — is made while scanning the catalog, before any card is selected and
 * before the drag starts. So the headline goes on the card itself and the detail
 * stays in the Inspector.
 *
 * Deliberately one line, worst-participant-only. A card carrying four rows of
 * per-player detail stops being scannable, which is the only thing the catalog
 * is for. `title` carries the per-player breakdown for a hover, and the
 * Inspector carries it properly.
 *
 * Rendered through `renderCardExtra` (courthive-components ≥ the version that
 * added it) rather than by post-processing `.spl-matchup-card`: the catalog
 * rebuilds its cards on every state change, so an externally appended node
 * would be wiped rather than reused.
 */

import { evaluateRest, formatDuration } from './inspectorRest';
import { t } from 'i18n';

// constants and types
import type { RestResult, RestRow, RestStatus } from './participantRest';

/** Worst-first; the first status present decides the badge. Mirrors the Inspector's row order. */
const SEVERITY: RestStatus[] = ['onCourt', 'resting', 'rested', 'none'];

/** The row that decides the badge — the worst status present. */
export function headlineRow(rows: RestRow[]): RestRow | undefined {
  for (const status of SEVERITY) {
    const row = rows.find((candidate) => candidate.status === status);
    if (row) return row;
  }
  return undefined;
}

/**
 * Badge text for a headline row. Short enough to sit in a chip: the duration
 * alone for a resting/rested player, a word for the states where a duration
 * would be a fiction.
 */
export function badgeText(row: RestRow): string {
  if (row.status === 'onCourt') return t('schedule.card.rest.onCourt');
  if (row.status === 'none') return t('schedule.card.rest.none');
  return formatDuration(row.restMinutes ?? 0);
}

/** Per-player breakdown for the hover, so the badge is not the only account available. */
export function badgeTooltip(rows: RestRow[]): string {
  return rows
    .map((row) => {
      if (row.status === 'onCourt') return t('schedule.card.rest.tooltipOnCourt', { name: row.participantName });
      if (row.status === 'none') return t('schedule.card.rest.tooltipNone', { name: row.participantName });
      return t('schedule.card.rest.tooltipRest', {
        name: row.participantName,
        rested: formatDuration(row.restMinutes ?? 0),
        required: formatDuration(row.requiredMinutes),
      });
    })
    .join('\n');
}

/**
 * True when the badge is worth drawing at all. A card where nobody has played
 * today carries no information — and that is most of the catalog on day one, so
 * badging it would be pure noise.
 */
export function shouldRender(result: RestResult): boolean {
  return result.evaluated && result.rows.some((row) => row.status !== 'none');
}

/**
 * The `renderCardExtra` implementation. Returns a fresh element per call, or
 * null when there is nothing worth saying.
 */
export function renderRestBadge(matchUpId: string, viewedDate: string | null): HTMLElement | null {
  if (!matchUpId) return null;

  const result = evaluateRest(matchUpId, viewedDate);
  if (!shouldRender(result) || !result.evaluated) return null;

  const row = headlineRow(result.rows);
  if (!row) return null;

  const badge = document.createElement('span');
  badge.className = `tmx-rest-badge is-${row.status.toLowerCase()}`;
  badge.dataset.restStatus = row.status;
  badge.textContent = badgeText(row);
  badge.title = badgeTooltip(result.rows);

  // The daily-limit signal is the one thing a director must not miss while
  // scanning, so it rides the badge rather than waiting for the Inspector.
  if (row.load.atLimit.length) {
    badge.dataset.atLimit = row.load.atLimit.join(',');
    const limit = document.createElement('span');
    limit.className = 'tmx-rest-badge-limit';
    limit.textContent = t('schedule.card.rest.limit', { ordinal: row.load.ordinal });
    badge.appendChild(limit);
  }
  return badge;
}
