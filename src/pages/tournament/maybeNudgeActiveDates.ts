import { openEditDatesModal } from './tabs/overviewTab/editDatesModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { tournamentEngine } from 'services/factory/engine';
import { t } from 'i18n';

// Module-scoped set tracking which tournamentIds have already triggered the
// nudge this page load. Without this the toast would re-fire on every tab
// change (renderTournament runs once per navigation, not just on initial
// load), which is the exact "annoying repeated popup" footgun we want to
// avoid. A page refresh resets the set, so users who dismissed and want a
// reminder can reload to see it again.
const nudgedTournamentIds = new Set<string>();

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayLocalIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function* dateRangeInclusive(startIso: string, endIso: string): Generator<string> {
  // UTC math so DST transitions don't skip or duplicate a day. We're only
  // comparing date strings; nothing here depends on wall-clock hours.
  const [sy, sm, sd] = startIso.split('-').map(Number);
  const [ey, em, ed] = endIso.split('-').map(Number);
  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  const last = new Date(Date.UTC(ey, em - 1, ed));
  while (cur.getTime() <= last.getTime()) {
    yield cur.toISOString().slice(0, 10);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
}

function scheduledDateOf(matchUp: any): string | null {
  const fromSchedule = matchUp?.schedule?.scheduledDate;
  if (typeof fromSchedule === 'string' && ISO_DATE_RE.test(fromSchedule)) return fromSchedule;
  // Fallback for engine outputs that didn't materialize the `schedule` object —
  // SCHEDULE.DATE in timeItems is the canonical source the engine reads from.
  const fromTimeItem = (matchUp?.timeItems || []).find((item: any) => item?.itemType === 'SCHEDULE.DATE')?.itemValue;
  if (typeof fromTimeItem === 'string' && ISO_DATE_RE.test(fromTimeItem)) return fromTimeItem;
  return null;
}

/**
 * On tournament load, suggest setting `activeDates` when the operator has
 * scheduled matchUps on a sparse set of days inside a wider start..end window.
 *
 * Why this exists: organizers commonly create a tournament that spans
 * multiple weeks but only play on weekends or specific days. Without
 * activeDates set, the public schedule tab on the public site shows a
 * date picker with every day in the range, most of which are empty —
 * confusing for spectators. The active-dates modal solves it but the
 * feature is not discoverable; this toast points it out exactly when
 * it's relevant.
 *
 * Trigger (all must hold):
 *   - today is inside [startDate, endDate]
 *   - tournament.activeDates is empty (we don't override an explicit choice)
 *   - at least one matchUp has a scheduled date (skips operators who
 *     don't use scheduling at all — the public schedule tab won't render
 *     for them so the spectator-side problem doesn't exist)
 *   - ≥2 calendar dates between startDate and today have no scheduled
 *     matchUps (a multi-week tournament where someone forgot, not a
 *     contiguous one where every day is filled)
 */
export function maybeNudgeActiveDates({ tournamentRecord }: { tournamentRecord?: any }): void {
  const tournamentId = tournamentRecord?.tournamentId;
  if (!tournamentId || nudgedTournamentIds.has(tournamentId)) return undefined;

  const startDate = tournamentRecord?.startDate;
  const endDate = tournamentRecord?.endDate;
  if (!ISO_DATE_RE.test(startDate) || !ISO_DATE_RE.test(endDate)) return undefined;

  if (Array.isArray(tournamentRecord.activeDates) && tournamentRecord.activeDates.length > 0) return undefined;

  const today = todayLocalIso();
  if (today < startDate || today > endDate) return undefined;

  let matchUps: any[];
  try {
    matchUps = tournamentEngine.allTournamentMatchUps()?.matchUps || [];
  } catch {
    return undefined;
  }

  const scheduledDates = new Set<string>();
  for (const matchUp of matchUps) {
    const date = scheduledDateOf(matchUp);
    if (date) scheduledDates.add(date);
  }
  if (scheduledDates.size === 0) return undefined;

  let emptyDaysBeforeToday = 0;
  for (const iso of dateRangeInclusive(startDate, today)) {
    if (!scheduledDates.has(iso)) {
      emptyDaysBeforeToday += 1;
      if (emptyDaysBeforeToday >= 2) break;
    }
  }
  if (emptyDaysBeforeToday < 2) return undefined;

  nudgedTournamentIds.add(tournamentId);

  tmxToast({
    message: t('toasts.activeDatesPrompt'),
    intent: 'is-info',
    pauseOnHover: true,
    duration: 8000,
    action: {
      text: t('toasts.activeDatesPromptAction'),
      onClick: () => openEditDatesModal({ onSave: () => undefined }),
    },
  });
}
