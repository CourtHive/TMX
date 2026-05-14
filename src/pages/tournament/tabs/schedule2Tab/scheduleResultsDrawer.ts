/**
 * Schedule 2 — Results Drawer
 *
 * Opens a modal that surfaces the full return value of `scheduleProfileRounds`
 * after Apply Schedule runs. The factory hands back a per-date breakdown for
 * every category of outcome (scheduled / over-limit / no-time / deferred for
 * recovery / deferred for dependencies / request conflicts), all of which were
 * previously discarded by the lone success toast.
 *
 * Each matchUp row is clickable and navigates the operator into the owning
 * draw so they can inspect or remediate.
 */
import { competitionEngine, tournamentEngine } from 'tods-competition-factory';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { openModal, closeModal } from 'components/modals/baseModal/baseModal';
import {
  describeOverLimitAttempts,
  describeRecoveryDeferred,
  describeDependencyDeferred,
  type MatchUpLookup,
  type ParticipantLookup,
  type OverLimitAttempt,
} from './scheduleResultsDescribe';

const BLOCK_STYLE = 'margin-top: 10px;';
const LIST_STYLE = 'list-style: none; padding: 0; margin: 6px 0 0 0; display: flex; flex-direction: column; gap: 2px;';

interface Lookups {
  matchUps: MatchUpLookup;
  participants: ParticipantLookup;
}

export type { OverLimitAttempt };

export type ScheduleProfileRoundsResult = {
  scheduledMatchUpIds?: { [date: string]: string[] };
  overLimitMatchUpIds?: { [date: string]: string[] };
  overLimitMatchUpDetails?: { [date: string]: OverLimitAttempt[] };
  noTimeMatchUpIds?: { [date: string]: string[] };
  recoveryTimeDeferredMatchUpIds?: {
    [date: string]: {
      [matchUpId: string]: { scheduleTime: string; blockingParticipantIds?: string[]; notBeforeTime?: string }[];
    };
  };
  dependencyDeferredMatchUpIds?: {
    [date: string]: { [matchUpId: string]: { scheduleTime: string; remainingDependencies?: string[] }[] };
  };
  requestConflicts?: { [date: string]: any[] };
  scheduledDates?: string[];
};

export function openScheduleResultsDrawer(result: ScheduleProfileRoundsResult): void {
  const lookups: Lookups = {
    matchUps: buildMatchUpLookup(),
    participants: buildParticipantLookup(),
  };
  const dates = collectAllDates(result);

  const content = document.createElement('div');
  content.style.cssText = 'display: flex; flex-direction: column; gap: 12px; min-width: 480px; max-height: 70vh; overflow-y: auto; padding: 4px;';

  if (!dates.length) {
    content.appendChild(buildEmptyState());
    openWideModal(content);
    return;
  }

  for (const date of dates) {
    content.appendChild(buildDateSection(date, result, lookups));
  }

  openWideModal(content);
}

function openWideModal(content: HTMLElement): void {
  openModal({
    title: 'Scheduling Results',
    content,
    buttons: [
      {
        label: 'Close',
        intent: 'is-primary',
        close: true,
        onClick: closeModal,
      },
    ],
    config: { padding: '0.5', maxWidth: 720 },
  });
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

function buildMatchUpLookup(): MatchUpLookup {
  const lookup: MatchUpLookup = new Map();
  const { matchUps } = competitionEngine.allCompetitionMatchUps({ inContext: true }) || {};
  if (!Array.isArray(matchUps)) return lookup;

  for (const matchUp of matchUps) {
    const sides = matchUp?.sides ?? [];
    const participantsLabel =
      sides
        .map((side: any) => side?.participant?.participantName || side?.participantName || '—')
        .join(' vs ') || '—';

    lookup.set(matchUp.matchUpId, {
      matchUpId: matchUp.matchUpId,
      drawId: matchUp.drawId,
      eventId: matchUp.eventId,
      drawName: matchUp.drawName,
      eventName: matchUp.eventName,
      roundLabel: formatRoundLabel(matchUp),
      participantsLabel,
      matchUpType: matchUp.matchUpType,
    });
  }
  return lookup;
}

function formatRoundLabel(matchUp: any): string {
  const roundName = matchUp?.roundName;
  const roundNumber = matchUp?.roundNumber;
  if (roundName) return roundName;
  if (roundNumber) return `R${roundNumber}`;
  return '';
}

function buildParticipantLookup(): ParticipantLookup {
  const lookup: ParticipantLookup = new Map();
  try {
    const { participants } = tournamentEngine.getParticipants?.() || ({} as any);
    if (Array.isArray(participants)) {
      for (const p of participants) {
        if (p?.participantId) lookup.set(p.participantId, p.participantName || p.participantId);
      }
    }
  } catch (err) {
    console.error('buildParticipantLookup failed', err);
  }
  return lookup;
}

// ---------------------------------------------------------------------------
// Date collection
// ---------------------------------------------------------------------------

function collectAllDates(result: ScheduleProfileRoundsResult): string[] {
  const set = new Set<string>();
  for (const date of result.scheduledDates ?? []) set.add(date);
  for (const date of Object.keys(result.scheduledMatchUpIds ?? {})) set.add(date);
  for (const date of Object.keys(result.overLimitMatchUpIds ?? {})) set.add(date);
  for (const date of Object.keys(result.noTimeMatchUpIds ?? {})) set.add(date);
  for (const date of Object.keys(result.recoveryTimeDeferredMatchUpIds ?? {})) set.add(date);
  for (const date of Object.keys(result.dependencyDeferredMatchUpIds ?? {})) set.add(date);
  for (const date of Object.keys(result.requestConflicts ?? {})) set.add(date);
  return [...set].sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildDateSection(date: string, result: ScheduleProfileRoundsResult, lookups: Lookups): HTMLElement {
  const section = document.createElement('section');
  section.style.cssText =
    'border: 1px solid var(--sp-line, var(--tmx-border-secondary)); border-radius: 8px; padding: 12px; background: var(--sp-panel-bg, var(--tmx-bg-primary));';

  const dateHeader = document.createElement('h3');
  dateHeader.textContent = formatDateHeading(date);
  dateHeader.style.cssText =
    'margin: 0 0 8px 0; font-size: 0.95rem; font-weight: 600; color: var(--tmx-text-primary); border-bottom: 1px solid var(--sp-line, var(--tmx-border-secondary)); padding-bottom: 6px;';
  section.appendChild(dateHeader);

  const scheduled = result.scheduledMatchUpIds?.[date] ?? [];
  const overLimit = result.overLimitMatchUpIds?.[date] ?? [];
  const overLimitDetails = result.overLimitMatchUpDetails?.[date] ?? [];
  const noTime = result.noTimeMatchUpIds?.[date] ?? [];
  const recoveryDeferred = result.recoveryTimeDeferredMatchUpIds?.[date] ?? {};
  const dependencyDeferred = result.dependencyDeferredMatchUpIds?.[date] ?? {};
  const conflicts = result.requestConflicts?.[date] ?? [];

  const empty =
    !scheduled.length &&
    !overLimit.length &&
    !noTime.length &&
    !Object.keys(recoveryDeferred).length &&
    !Object.keys(dependencyDeferred).length &&
    !conflicts.length;

  if (empty) {
    const note = document.createElement('p');
    note.textContent = 'No scheduler activity on this date.';
    note.style.cssText = 'margin: 0; font-size: 0.8rem; color: var(--sp-muted, var(--tmx-text-muted));';
    section.appendChild(note);
    return section;
  }

  if (scheduled.length) {
    section.appendChild(buildCategoryBlock('Scheduled', scheduled, lookups.matchUps, 'success'));
  }
  if (overLimit.length) {
    section.appendChild(buildOverLimitBlock(overLimit, overLimitDetails, lookups));
  }
  if (noTime.length) {
    section.appendChild(buildCategoryBlock('No Time', noTime, lookups.matchUps, 'warning'));
  }
  const recoveryIds = Object.keys(recoveryDeferred);
  if (recoveryIds.length) {
    section.appendChild(buildRecoveryDeferredBlock(recoveryDeferred, lookups));
  }
  const dependencyIds = Object.keys(dependencyDeferred);
  if (dependencyIds.length) {
    section.appendChild(buildDependencyDeferredBlock(dependencyDeferred, lookups));
  }
  if (conflicts.length) {
    section.appendChild(buildConflictsBlock(conflicts, lookups.matchUps));
  }

  return section;
}

// Over-limit refusals get a richer treatment than the generic
// buildCategoryBlock: per matchUp we group the attempts (one per attempted
// time slot) and render the participants that hit a cap, with which
// counter they reached and at what value vs. its limit.
function buildOverLimitBlock(ids: string[], details: OverLimitAttempt[], lookups: Lookups): HTMLElement {
  const block = document.createElement('div');
  block.style.cssText = BLOCK_STYLE;

  const header = buildCategoryHeader('Over Limit', ids.length, 'warning');
  block.appendChild(header);

  // Group attempts by matchUpId so multiple attempted times collapse into one row.
  const byMatchUpId = new Map<string, OverLimitAttempt[]>();
  for (const d of details) {
    const list = byMatchUpId.get(d.matchUpId) ?? [];
    list.push(d);
    byMatchUpId.set(d.matchUpId, list);
  }

  const list = document.createElement('ul');
  list.style.cssText = LIST_STYLE;
  for (const id of ids) {
    const attempts = byMatchUpId.get(id) ?? [];
    const detailText = describeOverLimitAttempts(attempts, lookups.participants);
    list.appendChild(buildMatchUpRow(id, lookups.matchUps, detailText));
  }
  block.appendChild(list);
  return block;
}

type Intent = 'success' | 'warning' | 'danger' | 'neutral';

function intentColor(intent: Intent): string {
  switch (intent) {
    case 'success':
      return 'var(--tmx-accent-green, #10b981)';
    case 'warning':
      return 'var(--tmx-accent-amber, #f59e0b)';
    case 'danger':
      return 'var(--tmx-accent-red, #ef4444)';
    default:
      return 'var(--tmx-text-secondary, #94a3b8)';
  }
}

function buildCategoryBlock(label: string, ids: string[], lookup: MatchUpLookup, intent: Intent): HTMLElement {
  const block = document.createElement('div');
  block.style.cssText = BLOCK_STYLE;

  const header = buildCategoryHeader(label, ids.length, intent);
  block.appendChild(header);

  const list = document.createElement('ul');
  list.style.cssText = LIST_STYLE;
  for (const id of ids) {
    list.appendChild(buildMatchUpRow(id, lookup));
  }
  block.appendChild(list);
  return block;
}

// Deferred for recovery time: the participants whose existing bookings
// overlap the proposed slot are the blockers. Render their names plus
// a notBefore hint when present (e.g. "not before 13:30").
function buildRecoveryDeferredBlock(
  deferred: { [matchUpId: string]: { scheduleTime: string; blockingParticipantIds?: string[]; notBeforeTime?: string }[] },
  lookups: Lookups,
): HTMLElement {
  const block = document.createElement('div');
  block.style.cssText = BLOCK_STYLE;

  const ids = Object.keys(deferred);
  const header = buildCategoryHeader('Deferred — Recovery', ids.length, 'neutral');
  block.appendChild(header);

  const list = document.createElement('ul');
  list.style.cssText = LIST_STYLE;
  for (const id of ids) {
    const attempts = deferred[id] ?? [];
    const detail = describeRecoveryDeferred(attempts, lookups.participants);
    list.appendChild(buildMatchUpRow(id, lookups.matchUps, detail));
  }
  block.appendChild(list);
  return block;
}

// Deferred for dependencies: surface the upstream matchUps still pending.
// remainingDependencies is an array of matchUpIds; resolve each to its
// participants/round label via the matchUp lookup when available.
function buildDependencyDeferredBlock(
  deferred: { [matchUpId: string]: { scheduleTime: string; remainingDependencies?: string[] }[] },
  lookups: Lookups,
): HTMLElement {
  const block = document.createElement('div');
  block.style.cssText = BLOCK_STYLE;

  const ids = Object.keys(deferred);
  const header = buildCategoryHeader('Deferred — Dependency', ids.length, 'neutral');
  block.appendChild(header);

  const list = document.createElement('ul');
  list.style.cssText = LIST_STYLE;
  for (const id of ids) {
    const attempts = deferred[id] ?? [];
    const detail = describeDependencyDeferred(attempts, lookups.matchUps);
    list.appendChild(buildMatchUpRow(id, lookups.matchUps, detail));
  }
  block.appendChild(list);
  return block;
}

function buildConflictsBlock(conflicts: any[], lookup: MatchUpLookup): HTMLElement {
  const block = document.createElement('div');
  block.style.cssText = BLOCK_STYLE;

  const header = buildCategoryHeader('Conflicts', conflicts.length, 'danger');
  block.appendChild(header);

  const list = document.createElement('ul');
  list.style.cssText = LIST_STYLE;
  for (const conflict of conflicts) {
    const matchUpId = conflict?.matchUpId;
    const detail = describeConflict(conflict);
    if (matchUpId) {
      list.appendChild(buildMatchUpRow(matchUpId, lookup, detail));
    } else {
      list.appendChild(buildDetailOnlyRow(detail || 'Conflict'));
    }
  }
  block.appendChild(list);
  return block;
}

function describeConflict(conflict: any): string {
  if (!conflict) return '';
  const reason = conflict.reason || conflict.type || conflict.requestType;
  const time = conflict.scheduleTime ? `@ ${conflict.scheduleTime}` : '';
  const participant = conflict.participantName ? `(${conflict.participantName})` : '';
  return [reason, time, participant].filter(Boolean).join(' ');
}

function buildCategoryHeader(label: string, count: number, intent: Intent): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display: flex; align-items: center; gap: 8px;';

  const dot = document.createElement('span');
  dot.style.cssText = `width: 8px; height: 8px; border-radius: 50%; background: ${intentColor(intent)};`;
  wrap.appendChild(dot);

  const title = document.createElement('strong');
  title.textContent = label;
  title.style.cssText = 'font-size: 0.8rem; color: var(--tmx-text-primary);';
  wrap.appendChild(title);

  const badge = document.createElement('span');
  badge.textContent = String(count);
  badge.style.cssText = `font-size: 0.7rem; padding: 1px 6px; border-radius: 999px; background: ${intentColor(intent)}; color: white;`;
  wrap.appendChild(badge);

  return wrap;
}

function buildMatchUpRow(matchUpId: string, lookup: MatchUpLookup, detail?: string): HTMLElement {
  const info = lookup.get(matchUpId);

  const row = document.createElement('li');
  row.style.cssText =
    'padding: 6px 8px; border-radius: 4px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; font-size: 0.78rem; transition: background 120ms;';
  row.addEventListener('mouseenter', () => (row.style.background = 'var(--sp-row-hover, rgba(148,163,184,0.12))'));
  row.addEventListener('mouseleave', () => (row.style.background = 'transparent'));

  const primary = document.createElement('span');
  primary.style.cssText = 'color: var(--tmx-text-primary); font-weight: 500;';
  primary.textContent = info?.participantsLabel ?? matchUpId;
  row.appendChild(primary);

  const secondaryParts = [info?.eventName, info?.drawName, info?.roundLabel].filter(Boolean);
  if (secondaryParts.length || detail) {
    const secondary = document.createElement('span');
    secondary.style.cssText = 'color: var(--sp-muted, var(--tmx-text-muted)); font-size: 0.72rem;';
    secondary.textContent = [...secondaryParts, detail].filter(Boolean).join(' • ');
    row.appendChild(secondary);
  }

  if (info?.eventId) {
    row.addEventListener('click', () => {
      closeModal();
      navigateToEvent({
        eventId: info.eventId,
        drawId: info.drawId,
        matchUpId,
        renderDraw: true,
      });
    });
  } else {
    row.style.cursor = 'default';
  }

  return row;
}

function buildDetailOnlyRow(text: string): HTMLElement {
  const row = document.createElement('li');
  row.style.cssText =
    'padding: 6px 8px; font-size: 0.78rem; color: var(--sp-muted, var(--tmx-text-muted));';
  row.textContent = text;
  return row;
}

function buildEmptyState(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'padding: 24px; text-align: center; color: var(--sp-muted, var(--tmx-text-muted)); font-size: 0.85rem;';
  wrap.textContent = 'The scheduler completed but reported no per-date activity.';
  return wrap;
}

function formatDateHeading(date: string): string {
  // Keep the raw ISO date in the heading — locale formatting can come later if needed.
  // Append a friendly weekday so a tournament director can scan dates fast.
  try {
    const d = new Date(`${date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return date;
    const weekday = d.toLocaleDateString(undefined, { weekday: 'short' });
    return `${date} — ${weekday}`;
  } catch {
    return date;
  }
}
