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
 *
 * ── Why the badge ticks ──
 *
 * Rest counts up, so a badge that is painted once and left alone is wrong from
 * the second after it renders. The Inspector has always repainted on a timer;
 * the badge did not, and the gap was not cosmetic — a card could sit reading
 * `41m` long after the player was rested, and a stale badge beside a live
 * Inspector reading something else is worse than either alone, because it makes
 * the operator distrust both. That mismatch is exactly what surfaced the
 * two-viewed-dates defect, and it took a while to establish which of the two was
 * lying.
 *
 * The catalog is NOT rebuilt to achieve this. Rebuilding every card on a timer
 * would cost the operator their scroll position, any open menu, and an in-flight
 * drag — the badge is a passenger on the card, and a passenger does not get to
 * demolish the vehicle. Instead the badges already in the document are repainted
 * in place, on the Inspector's cadence so the two never disagree.
 */

import { evaluateRest, formatDuration, makeRestEvaluator } from './inspectorRest';
import { t } from 'i18n';

// constants and types
import type { RestResult, RestRow, RestStatus } from './participantRest';

/** Worst-first; the first status present decides the badge. Mirrors the Inspector's row order. */
const SEVERITY: RestStatus[] = ['onCourt', 'resting', 'rested', 'none'];

/**
 * The row that decides the badge — the worst status present, and within that
 * status the participant furthest from being ready.
 *
 * The within-status choice is `analyzeParticipantRest`'s to make: it sorts rows
 * by band and then by shortfall, so taking the first of a band is taking the
 * worst of it. That ordering is the contract between the two — a caller passing
 * unsorted rows would get the right band and an arbitrary member of it, which is
 * the bug this pairing was written to close.
 */
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
  // A future anchor yields a zero that is arithmetic, not measurement. Showing
  // `0m` would read as "just walked off", which is the opposite of unknown.
  if (row.anchorUnreliable) return t('schedule.card.rest.unknown');
  return formatDuration(row.restMinutes ?? 0);
}

/** Per-player breakdown for the hover, so the badge is not the only account available. */
export function badgeTooltip(rows: RestRow[]): string {
  return rows
    .map((row) => {
      if (row.status === 'onCourt') {
        const key = row.overrun ? 'schedule.card.rest.tooltipOnCourtOverrun' : 'schedule.card.rest.tooltipOnCourt';
        return t(key, { name: row.participantName });
      }
      if (row.status === 'none') return t('schedule.card.rest.tooltipNone', { name: row.participantName });
      if (row.anchorUnreliable) return t('schedule.card.rest.tooltipUnknown', { name: row.participantName });
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
 * Everything the badge displays, as plain data.
 *
 * Extracted so the first paint and every repaint go through one derivation. A
 * ticker that rebuilt the badge by a second, parallel route would drift from the
 * original — which is the shape of the bug this file's whole history is about.
 */
export interface RestBadgeModel {
  status: RestStatus;
  text: string;
  title: string;
  /** Joined limit keys for the data attribute; empty when no limit is met. */
  atLimit: string;
  /** The "#3" marker riding the badge; empty when no limit is met. */
  limitText: string;
}

/** The badge's data for one matchUp, or null when there is nothing worth drawing. */
export function badgeModel(result: RestResult): RestBadgeModel | null {
  if (!shouldRender(result) || !result.evaluated) return null;
  const row = headlineRow(result.rows);
  if (!row) return null;

  return {
    status: row.status,
    text: badgeText(row),
    title: badgeTooltip(result.rows),
    atLimit: row.load.atLimit.join(','),
    // The daily-limit signal is the one thing a director must not miss while
    // scanning, so it rides the badge rather than waiting for the Inspector.
    limitText: row.load.atLimit.length ? t('schedule.card.rest.limit', { ordinal: row.load.ordinal }) : '',
  };
}

/** Write a model onto an element, creating or removing the limit marker to match. */
function applyBadge(badge: HTMLElement, model: RestBadgeModel): void {
  badge.className = `tmx-rest-badge is-${model.status.toLowerCase()}`;
  badge.dataset.restStatus = model.status;
  badge.title = model.title;

  // `textContent =` would take the limit marker with it, so the leading text node
  // is addressed on its own and the marker survives every repaint.
  const existing = badge.querySelector<HTMLElement>('.tmx-rest-badge-limit');
  const leading = badge.firstChild;
  if (leading?.nodeType === Node.TEXT_NODE) {
    leading.textContent = model.text;
  } else {
    badge.prepend(document.createTextNode(model.text));
  }

  if (!model.limitText) {
    delete badge.dataset.atLimit;
    existing?.remove();
    return;
  }
  badge.dataset.atLimit = model.atLimit;
  const limit = existing ?? document.createElement('span');
  limit.className = 'tmx-rest-badge-limit';
  limit.textContent = model.limitText;
  if (!existing) badge.appendChild(limit);
}

// ── Live refresh ──────────────────────────────────────────────────────────
// One module-level interval drives every badge currently in the document. It
// stops itself once none are connected, which is what makes it safe against the
// catalog rebuilding its cards on every state change and against the schedule
// tab unmounting without telling us — the same contract `inspectorRest.ts` uses
// for its section, and the same cadence, so a card and the Inspector never
// disagree about a figure that is only counting up.

const REFRESH_MS = 30_000;
let tickHandle: ReturnType<typeof setInterval> | null = null;

function stopTicker(): void {
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = null;
}

function tick(): void {
  const badges = Array.from(document.querySelectorAll<HTMLElement>('.tmx-rest-badge[data-matchup-id]'));
  if (!badges.length) {
    stopTicker();
    return;
  }
  // One evaluator for the whole pass: the engine work is per-tournament, not
  // per-card, and every badge in a tick should agree about what time it is.
  const evaluate = makeRestEvaluator();
  for (const badge of badges) {
    const matchUpId = badge.dataset.matchUpId;
    if (!matchUpId) continue;
    const model = badgeModel(evaluate(matchUpId, badge.dataset.viewedDate || null));
    // A badge with nothing left to say is removed rather than frozen — this node
    // is ours, appended by `renderCardExtra`, so taking it back is not reaching
    // into the card's own markup.
    if (model) applyBadge(badge, model);
    else badge.remove();
  }
}

/**
 * The `renderCardExtra` implementation. Returns a fresh element per call, or
 * null when there is nothing worth saying.
 */
export function renderRestBadge(matchUpId: string, viewedDate: string | null): HTMLElement | null {
  if (!matchUpId) return null;

  const model = badgeModel(evaluateRest(matchUpId, viewedDate));
  if (!model) return null;

  const badge = document.createElement('span');
  // Carried on the element because the ticker finds badges by query rather than
  // by a registry: a registry would have to be invalidated every time the
  // catalog discarded a card, and the document already knows which ones exist.
  badge.dataset.matchUpId = matchUpId;
  if (viewedDate) badge.dataset.viewedDate = viewedDate;
  applyBadge(badge, model);

  tickHandle ??= setInterval(tick, REFRESH_MS);
  return badge;
}
