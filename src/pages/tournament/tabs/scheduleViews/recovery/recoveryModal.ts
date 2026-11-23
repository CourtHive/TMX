/**
 * Rain-day recovery, T4 (Mentat planning/RAIN_DAY_RECOVERY_PLAN.md § 4): the Recovery panel. It projects the target day
 * (the day after the interrupted day: the venue's today) with the carryover, under both release policies side by side
 * (CA 2026-11-23, Q3), and saves either one as a Plan-mode scenario, times only (Q5).
 *
 * Opened from Plan mode's chrome and from the carryover WARNING's modal (T5), both only while `schedulePlan` is on (Q1).
 * Projecting reads the live record and writes nothing (`runRecovery` works on a deep copy). Saving is Plan mode's own
 * `addScheduleScenario`, through `mutationRequest`; making the plan official stays Plan mode's existing commit.
 */
import { addScheduleScenario } from 'services/scheduleScenarios/scheduleScenariosService';
import { analyzeCarryover, isConcluded } from '../carryoverAnalysis';
import { formatDateLabel } from 'components/schedule/scheduleDateSelectorLogic';
import { openModal, closeModal } from 'components/modals/baseModal/baseModal';
import { runRecovery, type RecoveryProjection } from './recoveryRun';
import { tmxToast } from 'services/notifications/tmxToast';
import { competitionEngine } from 'services/factory/engine';
import { getCachedAllMatchUps } from '../schedule2DataCache';
import { venueToday } from 'functions/venueTimeFrame';
import { recoveryPlacements } from './recoveryPlacements';
import { setActivePlanScenarioId } from '../planSelection';
import { isScheduleLocked } from '../scheduleLocks';
import { context } from 'services/context';
import { t } from 'i18n';

import { NONE, SCHEDULING_TAB, TOURNAMENT } from 'constants/tmxConstants';

const SINGLES_LIMITS = [2, 3, 4];
const NOTE = 'tmx-recovery-note';

type RecoveryInputs = {
  scheduleDate: string;
  carryover: any[];
  targetDay: any[];
  lockedCount: number;
};

/** the carryover to re-place and the target day's own matchUps, from the cached matchUps */
export function recoveryInputs(scheduleDate: string = venueToday()): RecoveryInputs {
  const { matchUps = [] } = getCachedAllMatchUps() ?? {};
  const { matchUpDependencies } = competitionEngine.getMatchUpDependencies({ matchUps }) ?? {};
  const { carryover: items } = analyzeCarryover({ matchUps, matchUpDependencies, today: scheduleDate });
  // a schedule-locked match is the director's to move: a plan skips it, so the recovery leaves it out and says so
  const carryover = items.map((item) => item.matchUp).filter((matchUp) => !isScheduleLocked(matchUp));
  const targetDay = matchUps.filter(
    (matchUp: any) =>
      matchUp.matchUpStatus !== 'BYE' &&
      matchUp.schedule?.scheduledDate === scheduleDate &&
      !isConcluded(matchUp) &&
      !isScheduleLocked(matchUp),
  );
  return { scheduleDate, carryover, targetDay, lockedCount: items.length - carryover.length };
}

export function openRecoveryModal(): void {
  const inputs = recoveryInputs();
  let singlesLimit: number | undefined;
  let body: HTMLElement | undefined;

  const render = () => {
    if (!body) return;
    body.innerHTML = '';
    body.appendChild(paragraph(t('schedule.recovery.intro', { date: formatDateLabel(inputs.scheduleDate) })));
    if (!inputs.carryover.length) {
      body.appendChild(paragraph(t('schedule.recovery.none'), NOTE));
      return;
    }
    if (inputs.lockedCount) {
      body.appendChild(paragraph(t('schedule.recovery.locked', { count: inputs.lockedCount }), NOTE));
    }
    body.appendChild(limitControl());

    const { venues = [] }: any = competitionEngine.getVenuesAndCourts() ?? {};
    const run = runRecovery({
      tournamentRecords: competitionEngine.getState()?.tournamentRecords ?? {},
      matchUpDailyLimits: singlesLimit ? { SINGLES: singlesLimit } : undefined,
      defaultVenueId: venues[0]?.venueId,
      scheduleDate: inputs.scheduleDate,
      carryover: inputs.carryover,
      targetDay: inputs.targetDay,
    });
    if (run.error) {
      body.appendChild(paragraph(t('schedule.recovery.failed'), 'tmx-recovery-error'));
      return;
    }

    body.appendChild(assumptionsLine(run.assumptions));
    const columns = document.createElement('div');
    columns.className = 'tmx-recovery-columns';
    columns.append(column('ready', run.ready), column('finish', run.finish));
    body.appendChild(columns);
    body.appendChild(paragraph(t('schedule.recovery.pacing'), NOTE));
  };

  const limitControl = () => {
    const label = document.createElement('label');
    label.className = 'tmx-recovery-limit';
    label.textContent = t('schedule.recovery.singlesLimit');
    const select = document.createElement('select');
    const options = [{ value: '', text: t('schedule.recovery.tournamentLimits') }].concat(
      SINGLES_LIMITS.map((limit) => ({ value: String(limit), text: String(limit) })),
    );
    for (const { value, text } of options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      option.selected = value === String(singlesLimit ?? '');
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      singlesLimit = select.value ? Number(select.value) : undefined;
      render();
    });
    label.appendChild(select);
    return label;
  };

  const column = (policy: 'ready' | 'finish', projection: RecoveryProjection) => {
    const { comparison } = projection;
    const col = document.createElement('section');
    col.className = 'tmx-recovery-column';
    col.dataset.recoveryPolicy = policy;

    const heading = document.createElement('h4');
    heading.textContent = t(`schedule.recovery.${policy}`);
    col.appendChild(heading);

    const summary = document.createElement('ul');
    summary.className = 'tmx-recovery-summary';
    const lines = [
      comparison.carryoverFinishTime
        ? t('schedule.recovery.carryoverFinish', { time: comparison.carryoverFinishTime })
        : t('schedule.recovery.carryoverNotPlaced'),
      t('schedule.recovery.startsHold', { hold: comparison.startsHold, timed: comparison.timedTargetCount }),
      t('schedule.recovery.beyond', { count: comparison.beyondDayMatchUpIds.length, total: comparison.totalCount }),
    ];
    if (comparison.unknownMinutesMatchUpIds.length) {
      lines.push(t('schedule.recovery.unknownMinutes', { count: comparison.unknownMinutesMatchUpIds.length }));
    }
    for (const line of lines) {
      const item = document.createElement('li');
      item.textContent = line;
      summary.appendChild(item);
    }
    col.appendChild(summary);

    const byId = new Map([...inputs.carryover, ...inputs.targetDay].map((matchUp) => [matchUp.matchUpId, matchUp]));
    for (const group of comparison.groups) {
      const details = document.createElement('details');
      details.className = 'tmx-recovery-group';
      const title = document.createElement('summary');
      const name = group.carryover
        ? t('schedule.recovery.carryoverGroup')
        : (group.importedStart ?? t('schedule.recovery.noStartGroup'));
      title.textContent = `${name} (${group.rows.length})`;
      details.appendChild(title);
      for (const row of group.rows) {
        const line = document.createElement('div');
        line.className = 'tmx-recovery-row';
        if (row.beyondDay) line.dataset.beyondDay = 'true';
        const who = document.createElement('span');
        who.textContent = matchUpLabel(byId.get(row.matchUpId));
        const when = document.createElement('span');
        when.className = 'tmx-recovery-time';
        when.textContent = row.projectedTime ?? t('schedule.recovery.anotherDay');
        if (row.holds) when.textContent += ` · ${t('schedule.recovery.holds')}`;
        line.append(who, when);
        details.appendChild(line);
      }
      col.appendChild(details);
    }

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'tmx-recovery-save';
    save.textContent = t('schedule.recovery.saveAsPlan');
    save.addEventListener('click', () => void saveAsPlan(policy, projection));
    col.appendChild(save);
    return col;
  };

  const saveAsPlan = async (policy: 'ready' | 'finish', projection: RecoveryProjection) => {
    const placements = recoveryPlacements({
      scheduleDate: inputs.scheduleDate,
      carryover: inputs.carryover,
      targetDay: inputs.targetDay,
      result: projection.result,
    });
    const tournamentId = inputs.carryover[0]?.tournamentId;
    if (!tournamentId || !placements.length) return;
    const result: any = await addScheduleScenario(tournamentId, {
      scenarioName: t('schedule.recovery.planName', {
        date: formatDateLabel(inputs.scheduleDate),
        policy: t(`schedule.recovery.${policy}`),
      }),
      scheduledDates: [inputs.scheduleDate],
      placements,
    });
    const scenarioId = result?.scenarioId ?? result?.scenario?.scenarioId;
    if (result?.error || !scenarioId) {
      tmxToast({ message: t('schedule.recovery.saveFailed'), intent: 'is-danger' });
      return;
    }
    closeModal();
    setActivePlanScenarioId(scenarioId);
    tmxToast({ message: t('schedule.recovery.saved'), intent: 'is-success' });
    const planRoute = `/${TOURNAMENT}/${tournamentId}/${SCHEDULING_TAB}/${inputs.scheduleDate}/plan`;
    // Navigo skips the handler for the current route. Refresh the mounted plan to show the new selection.
    if (globalThis.location.hash === `#${planRoute}`) context.refreshActiveTable?.();
    else context.router?.navigate(planRoute);
  };

  openModal({
    title: t('schedule.recovery.title'),
    content: (elem: HTMLElement) => {
      elem.classList.add('tmx-recovery-modal');
      body = elem;
      render();
    },
    config: { padding: '.5', content: { padding: '1' }, maxWidth: 960 },
    buttons: [{ label: t('common.close'), intent: NONE, close: true }],
  });
}

function paragraph(text: string, className?: string): HTMLElement {
  const p = document.createElement('p');
  if (className) p.className = className;
  p.textContent = text;
  return p;
}

function assumptionsLine(assumptions: { matchUpFormat?: string; averageMinutes?: number; recoveryMinutes?: number }[]) {
  const line = document.createElement('p');
  line.className = NOTE;
  const parts = assumptions
    .filter(({ averageMinutes }) => averageMinutes !== undefined)
    .map(({ matchUpFormat, averageMinutes, recoveryMinutes }) =>
      t('schedule.recovery.assumption', {
        format: matchUpFormat ?? t('schedule.recovery.defaultFormat'),
        average: averageMinutes,
        rest: recoveryMinutes ?? 0,
      }),
    );
  line.textContent = `${t('schedule.recovery.assumptions')}: ${[...new Set(parts)].join(' · ')}`;
  return line;
}

function matchUpLabel(matchUp: any): string {
  const names = (matchUp?.sides ?? []).map((side: any) => side?.participant?.participantName).filter(Boolean);
  const what = [matchUp?.eventName, matchUp?.roundName].filter(Boolean).join(' ');
  return [names.length ? names.join(' – ') : undefined, what].filter(Boolean).join(' · ');
}
