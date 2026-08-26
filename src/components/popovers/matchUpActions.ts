/**
 * MatchUp actions popover menu.
 * Provides options for start/end time, official selection, and schedule clearing.
 */
import { openNominateScorekeeper, removeScorekeeperNomination } from 'services/crowd/nominateScorekeeperFlow';
import { confirmDelegatedOutcome, openSetDelegatedOutcome } from 'services/crowd/delegatedOutcomeFlow';
import { evaluateEligibility, mergeVerdicts } from 'services/officiating/officialEligibility';
import { evaluateCandidate, resolveConflictPolicy } from 'services/officiating/officialConflicts';
import { fetchOfficialRecords } from 'services/apis/officiatingApi';
import {
  buildScheduleLockMethod,
  canToggleScheduleLock,
  isScheduleLocked,
} from 'pages/tournament/tabs/scheduleViews/scheduleLocks';
import { getMatchUpCheckInState, checkInSummary } from 'services/checkIn/checkInState';
import { resolveTimeSeed, validateTimeValue } from 'components/tables/matchUpsTable/scheduleTimeFields';
import { setMatchUpSchedule } from 'components/tables/matchUpsTable/setMatchUpSchedule';
import { getCourtTimeBounds } from 'components/tables/matchUpsTable/courtTimeBounds';
import { tmxToast } from 'services/notifications/tmxToast';
import { toggleCheckIn } from 'services/checkIn/toggleCheckIn';
import type { CandidateConflicts } from 'services/officiating/officialConflicts';
import { openCrowdTrackersModal } from 'components/modals/crowdTrackersModal';
import { getScheduleDateRange } from 'pages/tournament/tabs/scheduleUtils';
import { getActiveSessionCount } from 'services/crowd/crowdActivityIndex';
import { readDelegatedOutcome } from 'services/crowd/delegatedOutcome';
import { ParticipantRoleEnum, tools } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { printMatchCards } from 'components/modals/printMatchCards';
import { logMutationError } from 'functions/logMutationError';
import { tournamentEngine } from 'services/factory/engine';
import { timePicker } from 'components/modals/timePicker';
import { datePicker } from 'components/modals/datePicker';
import { tipster } from 'components/popovers/tipster';
import { isFunction } from 'functions/typeOf';
import tippy, { Instance } from 'tippy.js';
import { t } from 'i18n';

// constants
import type { ScheduleTimeField } from 'components/tables/matchUpsTable/scheduleTimeFields';
import { ADD_MATCHUP_OFFICIAL, DELETE_ADHOC_MATCHUPS } from 'constants/mutationConstants';
import { BOTTOM } from 'constants/tmxConstants';

// ParticipantRoleEnum, not the participantRoles object: the object's members
// widen to `string` by object-literal inference and cannot satisfy factory's own
// ParticipantRoleUnion. Enum members keep their literal type.
const OFFICIAL = ParticipantRoleEnum.OFFICIAL;

let officialTip: Instance | undefined;
let checkInTip: Instance | undefined;

/** Shared tippy theme for the popover panels this module opens. */
const TIP_THEME = 'light-border';
const ARIA_HIDDEN = 'aria-hidden';

function destroyCheckInTip() {
  if (checkInTip) {
    checkInTip.destroy();
    checkInTip = undefined;
  }
}

function destroyOfficialTip() {
  if (officialTip) {
    officialTip.destroy();
    officialTip = undefined;
  }
}

export function matchUpActions({
  pointerEvent,
  cell,
  matchUp,
  callback,
}: {
  pointerEvent: PointerEvent;
  cell?: any;
  matchUp?: any;
  callback?: (data: any) => void;
}): void {
  const tips = Array.from(document.querySelectorAll('.tippy-content'));
  if (tips.length) {
    tips.forEach((n) => n.remove());
    return;
  }

  const target = cell && (pointerEvent.target as HTMLElement)?.getElementsByClassName('fa-ellipsis-vertical')[0];
  const data = cell?.getRow().getData() || matchUp;

  const hasSchedule =
    matchUp?.schedule?.scheduledTime ||
    matchUp?.schedule?.scheduledDate ||
    matchUp?.schedule?.venueId ||
    matchUp?.schedule?.courtId;

  const updateRow = (updates: any) => {
    if (!cell) {
      if (callback) callback({ refresh: true });
      return;
    }
    const row = cell.getRow();
    row.update({ ...data, ...updates });
  };

  const clearSchedule = () => {
    const schedule = {
      scheduledDate: '',
      scheduledTime: '',
      courtId: '',
      venueId: '',
    };
    setMatchUpSchedule({
      matchUpId: matchUp.matchUpId,
      schedule,
      callback: () => updateRow({ ...schedule, courtName: '', venueName: '' }),
    });
  };

  const toggleScheduleLock = () => {
    const drawId = matchUp?.drawId;
    if (!drawId) return;
    const locked = isScheduleLocked(matchUp);
    mutationRequest({
      methods: [buildScheduleLockMethod({ matchUpId: matchUp.matchUpId, drawId, locked: !locked })],
      callback: () => updateRow({ scheduleLocked: !locked }),
    });
  };

  const setScheduleDate = () => {
    const existingDate = matchUp?.schedule?.scheduledDate || '';
    const activeDates = getScheduleDateRange();
    datePicker({
      date: existingDate,
      activeDates,
      callback: ({ date }) => {
        if (!date) return;
        setMatchUpSchedule({
          matchUpId: matchUp.matchUpId,
          schedule: { scheduledDate: date },
          callback: () => updateRow({ scheduledDate: date }),
        });
      },
    });
  };

  const applySelectedTime = (field: ScheduleTimeField, time: string) => {
    const schedule = matchUp?.schedule || {};
    const bounds = getCourtTimeBounds(matchUp);
    const converted = tools.dateTime.convertTime(time, true) as string;
    if (!converted) return;

    // Previously each of these checks was a bare `return`, so a rejected time looked identical to
    // no interaction at all. The old ordering check also refused any end before its start, which
    // blocked the after-midnight finishes the engine accepts — `validateTimeValue` mirrors the
    // engine's own cross-midnight rule instead.
    const invalid = validateTimeValue({ field, value: converted, schedule, bounds });
    if (invalid) {
      tmxToast({ message: invalid, intent: 'is-danger' });
      return;
    }

    setMatchUpSchedule({
      matchUpId: matchUp.matchUpId,
      schedule: { [field]: converted },
      callback: () => updateRow({ [field]: converted }),
    });
  };

  const setTimeField = (field: ScheduleTimeField) => {
    const schedule = matchUp?.schedule || {};
    const bounds = getCourtTimeBounds(matchUp);

    timePicker({
      time: resolveTimeSeed({ field, schedule, bounds }),
      callback: ({ time }) => applySelectedTime(field, time),
    });
  };

  /** Bounded so an unconfigured or unreachable AMS cannot stall the picker. */
  const OFFICIALS_REGISTRY_TIMEOUT_MS = 1500;

  const selectOfficial = async () => {
    const { participants: officials = [] } = tournamentEngine.getParticipants({
      participantFilters: { participantRoles: [OFFICIAL] },
    });

    if (!officials.length) {
      const noOfficialsEl = document.createElement('div');
      noOfficialsEl.style.cssText =
        'padding:12px; min-width:160px; text-align:center; color:var(--chc-text-secondary, #888);';
      noOfficialsEl.textContent = t('officiating.noOfficialsFound');

      const anchorEl = (target || pointerEvent.target) as HTMLElement;
      destroyOfficialTip();
      officialTip = tippy(anchorEl, {
        content: noOfficialsEl,
        theme: TIP_THEME,
        trigger: 'manual',
        interactive: true,
        placement: BOTTOM as any,
        appendTo: document.body,
      });
      officialTip.show();
      setTimeout(() => destroyOfficialTip(), 2000);
      return;
    }

    const currentOfficialId = matchUp?.schedule?.official;

    // Conflict state per candidate, computed locally — no fetch. Evaluated up front so a TD is never
    // offered a choice that will be refused.
    const conflictPolicy = resolveConflictPolicy();

    // Certification / suspension state lives in courthive-ams, so this one is a fetch. It is bounded
    // rather than awaited indefinitely: most tournaments have no registry configured at all, and a
    // picker that stalls waiting for a service that will never answer is worse than one that opens
    // saying "not checked". A timeout resolves to `undefined`, which IS the not-checkable signal —
    // the failure mode and the honest answer are the same value, so there is nothing to get wrong.
    const recordsById = await fetchOfficialRecords(
      officials.map((official: any) => official?.person?.personId ?? official.participantId),
      AbortSignal.timeout(OFFICIALS_REGISTRY_TIMEOUT_MS),
    );

    const conflictByOfficial = new Map<string, CandidateConflicts>(
      officials.map((official: any) => [
        official.participantId,
        mergeVerdicts(
          evaluateCandidate({
            officialParticipantId: official.participantId,
            policyDefinitions: conflictPolicy,
            matchUpId: matchUp.matchUpId,
            drawId: matchUp.drawId,
          }),
          evaluateEligibility({
            recordsById,
            personId: official?.person?.personId ?? official.participantId,
            asOfDate: matchUp?.schedule?.scheduledDate,
          }),
        ),
      ]),
    );

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative; padding:8px; padding-top:20px; min-width:160px;';

    const closeBtn = document.createElement('span');
    closeBtn.textContent = '\u00d7';
    closeBtn.style.cssText =
      'position:absolute; top:2px; right:6px; cursor:pointer; font-size:16px; line-height:1; color:var(--chc-text-secondary, #888); z-index:1;';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      destroyOfficialTip();
    };
    wrapper.appendChild(closeBtn);

    const list = document.createElement('ul');
    list.style.cssText = 'list-style:none; margin:0; padding:0;';

    for (const official of officials) {
      const li = document.createElement('li');
      li.style.cssText = 'padding:4px 8px; cursor:pointer; border-radius:4px;';
      if (official.participantId === currentOfficialId) {
        li.style.backgroundColor = 'var(--tmx-accent-blue, #3273dc)';
        li.style.color = '#fff';
      }
      const conflict = conflictByOfficial.get(official.participantId) ?? { level: 'none', reasons: [] };
      const isBlocked = conflict.level === 'blocked';
      // `unknown` = the check could not run. Rendered distinctly and still SELECTABLE: failing open is
      // the deliberate behaviour, and the factory gate re-runs the check on the mutation anyway. What
      // must not happen is it looking like `none`, which is "assessed and clean".
      const notChecked = conflict.level === 'unknown';

      li.textContent = official.participantName ?? null;
      if (notChecked) {
        li.title = `${t('officiating.notChecked')}\n${conflict.reasons.join('\n')}`;
        const mark = document.createElement('span');
        mark.textContent = '?';
        mark.setAttribute(ARIA_HIDDEN, 'true');
        mark.style.cssText = 'margin-left:6px; font-weight:700; color: var(--chc-text-secondary, #888);';
        li.appendChild(mark);
        li.setAttribute('data-conflict', 'unknown');
      } else if (conflict.level !== 'none') {
        // Reasons come from the factory already human-readable, e.g. "Official shares a COACH grouping
        // (Team Alpha) with this participant" — the UI lists them rather than composing a sentence.
        li.title = conflict.reasons.join('\n');
        const dot = document.createElement('span');
        dot.textContent = '\u25cf';
        dot.setAttribute(ARIA_HIDDEN, 'true');
        dot.style.cssText = `margin-left:6px; color:${isBlocked ? 'var(--tmx-danger, #d64545)' : 'var(--tmx-warning, #d99e00)'};`;
        li.appendChild(dot);
        li.setAttribute('data-conflict', conflict.level);
      }
      if (isBlocked) {
        li.style.cursor = 'not-allowed';
        li.style.opacity = '0.55';
        li.setAttribute('aria-disabled', 'true');
      }

      li.onmouseenter = () => {
        if (official.participantId !== currentOfficialId) li.style.backgroundColor = 'var(--chc-hover-bg, #f0f0f0)';
      };
      li.onmouseleave = () => {
        if (official.participantId !== currentOfficialId) li.style.backgroundColor = '';
      };
      li.onclick = (e) => {
        e.stopPropagation();
        // A blocking conflict is not selectable. The factory refuses it too — this only avoids
        // dispatching a mutation that is certain to be rejected.
        if (isBlocked) return;
        if (
          conflict.level === 'warn' &&
          !window.confirm(`${t('officiating.conflictWarning')}\n\n${conflict.reasons.join('\n')}`)
        )
          return;
        destroyOfficialTip();
        const methods = [
          {
            method: ADD_MATCHUP_OFFICIAL,
            params: {
              matchUpId: matchUp.matchUpId,
              drawId: matchUp.drawId,
              participantId: official.participantId,
              // The factory gate is the enforcement point; the UI annotation is an affordance.
              policyDefinitions: conflictPolicy,
            },
          },
        ];
        mutationRequest({
          methods,
          callback: (result: any) => {
            if (result.success) updateRow({ official: official.participantName });
          },
        });
      };
      list.appendChild(li);
    }

    wrapper.appendChild(list);

    const anchorEl = (target || pointerEvent.target) as HTMLElement;
    destroyOfficialTip();
    officialTip = tippy(anchorEl, {
      content: wrapper,
      theme: TIP_THEME,
      trigger: 'manual',
      interactive: true,
      maxWidth: 'none',
      placement: BOTTOM as any,
      appendTo: document.body,
    });
    officialTip.show();
  };

  /**
   * The desk panel: one row per INDIVIDUAL, click to toggle.
   *
   * Rows are individuals even for doubles — four names, not two pairs — because the state a desk is
   * managing is "one of the partners is standing here" (D4c). The panel re-derives from the engine
   * after each toggle rather than mutating the row locally, so two operators working the same match
   * converge instead of drifting.
   */
  const openCheckInPanel = () => {
    // A sibling of `render`, not nested inside its row loop: the mutation callback would otherwise be
    // a fifth level of nested function and trip `sonarjs/no-nested-functions` (threshold 4).
    const handleToggle = (participantId: string) =>
      toggleCheckIn({
        participantId,
        matchUpId: matchUp.matchUpId,
        drawId: matchUp.drawId,
        callback: (result: any) => onToggled(result),
      });

    const onToggled = (result: any) => {
      if (!result?.success) {
        logMutationError('checkIn', result, { message: t('checkIn.toggleFailed') });
        return;
      }
      // Re-render the panel from the engine, and refresh the row behind it so the summary the menu
      // shows agrees with what the panel is showing.
      render();
      updateRow({});
    };

    const render = () => {
      // Re-read from the engine so the panel reflects what was actually stored, including a toggle
      // made from another surface. `findMatchUp` returns it hydrated, which is what carries
      // `checkedInParticipantIds` (attached by `addMatchUpContext`).
      const stored = tournamentEngine.findMatchUp({ drawId: matchUp.drawId, matchUpId: matchUp.matchUpId })?.matchUp;
      const state = getMatchUpCheckInState(stored ?? matchUp);

      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:relative; padding:8px; padding-top:22px; min-width:200px;';

      const closeBtn = document.createElement('span');
      closeBtn.textContent = '\u00d7';
      closeBtn.style.cssText =
        'position:absolute; top:2px; right:6px; cursor:pointer; font-size:16px; line-height:1; color:var(--chc-text-secondary, #888); z-index:1;';
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        destroyCheckInTip();
      };
      wrapper.appendChild(closeBtn);

      const heading = document.createElement('div');
      heading.className = 'tmx-checkin-heading';
      heading.textContent = `${t('checkIn.title')} ${checkInSummary(state)}`;
      wrapper.appendChild(heading);

      const list = document.createElement('ul');
      list.style.cssText = 'list-style:none; margin:0; padding:0;';

      for (const participant of state.participants) {
        const li = document.createElement('li');
        li.className = participant.checkedIn ? 'tmx-checkin-row is-checked-in' : 'tmx-checkin-row';
        li.title = participant.checkedIn ? t('checkIn.clickToCheckOut') : t('checkIn.clickToCheckIn');

        const mark = document.createElement('span');
        mark.className = 'tmx-checkin-mark';
        mark.setAttribute(ARIA_HIDDEN, 'true');
        mark.textContent = participant.checkedIn ? '\u2713' : '\u25cb';
        li.appendChild(mark);

        const name = document.createElement('span');
        name.textContent = participant.participantName;
        li.appendChild(name);

        li.onclick = (e) => {
          e.stopPropagation();
          handleToggle(participant.participantId);
        };
        list.appendChild(li);
      }

      wrapper.appendChild(list);

      const anchorEl = (target || pointerEvent.target) as HTMLElement;
      destroyCheckInTip();
      checkInTip = tippy(anchorEl, {
        content: wrapper,
        theme: TIP_THEME,
        trigger: 'manual',
        interactive: true,
        maxWidth: 'none',
        placement: BOTTOM as any,
        appendTo: document.body,
      });
      checkInTip.show();
    };

    render();
  };

  const matchUpStatus = matchUp?.matchUpStatus;
  const noParticipants = !matchUp?.sides?.some((s: any) => s?.participantId);
  const terminalStatuses = [
    'BYE',
    'WALKOVER',
    'DOUBLE_WALKOVER',
    'CANCELLED',
    'ABANDONED',
    'DOUBLE_DEFAULT',
    'DEFAULTED',
  ];
  const isTerminal = terminalStatuses.includes(matchUpStatus);
  const hideTimeOptions = noParticipants || isTerminal;

  const crowdTrackerCount = matchUp?.matchUpId ? getActiveSessionCount(matchUp.matchUpId) : 0;
  const hasDelegatedOutcome = !!readDelegatedOutcome(matchUp);

  // Offered only where a lock would mean something — not completed, and actually
  // placed. `canToggleScheduleLock` asks the factory rather than reusing the
  // local `hasSchedule` above, which is looser: it omits courtOrder and
  // allocatedCourts, so a TEAM matchUp with courts allocated but no date would
  // be offered a lock the engine treats as inert.
  const hideScheduleLock = !canToggleScheduleLock(matchUp);

  const items = [
    {
      onClick: clearSchedule,
      text: 'Clear schedule',
      hide: !hasSchedule,
    },
    {
      onClick: toggleScheduleLock,
      text: isScheduleLocked(matchUp) ? t('schedule.unlockSchedule') : t('schedule.lockSchedule'),
      hide: hideScheduleLock,
    },
    {
      onClick: setScheduleDate,
      text: 'Schedule date',
    },
    {
      onClick: () => setTimeField('scheduledTime'),
      text: 'Schedule time',
    },
    {
      onClick: () => setTimeField('startTime'),
      text: 'Start time',
      hide: hideTimeOptions,
    },
    {
      onClick: () => setTimeField('endTime'),
      text: 'End time',
      hide: hideTimeOptions,
    },
    {
      // Per-matchUp check-in — the desk action. Deliberately worded "Check in", never "Sign in":
      // signing in is arrival at the tournament and is tournament-wide (D4a).
      onClick: openCheckInPanel,
      text: `${t('checkIn.action')} (${checkInSummary(getMatchUpCheckInState(matchUp))})`,
      hide: noParticipants || isTerminal,
    },
    {
      onClick: () => void selectOfficial(),
      text: t('officiating.selectOfficial'),
    },
    {
      onClick: () => printMatchCards({ matchUpIds: [matchUp.matchUpId], drawId: matchUp.drawId, action: 'open' }),
      text: 'Print match card',
    },
    {
      onClick: () =>
        openCrowdTrackersModal({
          matchUpId: matchUp.matchUpId,
          matchUpLabel: matchUp?.roundName ? `${matchUp.roundName}` : undefined,
        }),
      text: t('crowd.viewTrackers', { count: crowdTrackerCount }),
      hide: crowdTrackerCount === 0,
    },
    {
      onClick: () => openNominateScorekeeper({ matchUpId: matchUp.matchUpId, drawId: matchUp.drawId }),
      text: t('crowd.nominateScorekeeper'),
      hide: noParticipants,
    },
    {
      onClick: () => removeScorekeeperNomination({ matchUpId: matchUp.matchUpId, drawId: matchUp.drawId }),
      text: t('crowd.removeScorekeeper'),
      hide: !matchUp?.schedule?.scorekeeper,
    },
    {
      onClick: () => openSetDelegatedOutcome({ matchUpId: matchUp.matchUpId, drawId: matchUp.drawId }),
      text: t('crowd.setDelegatedOutcome'),
      hide: crowdTrackerCount === 0,
    },
    {
      onClick: () => confirmDelegatedOutcome({ matchUpId: matchUp.matchUpId, drawId: matchUp.drawId, matchUp }),
      text: t('crowd.confirmDelegatedOutcome'),
      hide: !hasDelegatedOutcome,
    },
  ];

  tipster({ items, target: target || (pointerEvent.target as HTMLElement), config: { placement: BOTTOM } });
}

export function deleteAdHocMatchUp({
  drawId,
  structureId,
  matchUpId,
  callback,
}: {
  drawId: string;
  structureId: string;
  matchUpId: string;
  callback?: () => void;
}): void {
  const methods = [
    {
      method: DELETE_ADHOC_MATCHUPS,
      params: {
        matchUpIds: [matchUpId],
        removeIncomplete: true,
        removeCompleted: true,
        structureId,
        drawId,
      },
    },
  ];
  const postMutation = (result: any) => {
    if (result.success) {
      if (isFunction(callback) && callback) callback();
    } else {
      logMutationError('deleteAdHocMatchUp', result);
    }
  };
  mutationRequest({ methods, callback: postMutation });
}
