/**
 * MatchUp actions popover menu.
 * Provides options for start/end time, official selection, and schedule clearing.
 */
import { setMatchUpSchedule } from 'components/tables/matchUpsTable/setMatchUpSchedule';
import { tournamentEngine, participantRoles, tools } from 'tods-competition-factory';
import { getScheduleDateRange } from 'pages/tournament/tabs/scheduleUtils';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { printMatchCards } from 'components/modals/printMatchCards';
import { logMutationError } from 'functions/logMutationError';
import { timePicker } from 'components/modals/timePicker';
import { datePicker } from 'components/modals/datePicker';
import { tipster } from 'components/popovers/tipster';
import { isFunction } from 'functions/typeOf';
import tippy, { Instance } from 'tippy.js';

// constants
import { ADD_MATCHUP_OFFICIAL, DELETE_ADHOC_MATCHUPS } from 'constants/mutationConstants';
import { BOTTOM } from 'constants/tmxConstants';

const { OFFICIAL } = participantRoles;

let officialTip: Instance | undefined;

function destroyOfficialTip() {
  if (officialTip) {
    officialTip.destroy();
    officialTip = undefined;
  }
}

function getTimeBounds(matchUp: any): { earliest?: string; latest?: string } {
  const { courts = [] } = tournamentEngine.getVenuesAndCourts() || {};
  if (!courts.length) {
    console.log('getTimeBounds: no courts found');
    return {};
  }

  const courtId = matchUp?.schedule?.courtId;
  const venueId = matchUp?.schedule?.venueId;
  const scheduledDate = matchUp?.schedule?.scheduledDate;

  let relevantCourts = courts;
  if (courtId) {
    relevantCourts = courts.filter((c: any) => c.courtId === courtId);
  } else if (venueId) {
    relevantCourts = courts.filter((c: any) => c.venueId === venueId);
  }

  console.log('getTimeBounds:', {
    courtId,
    venueId,
    scheduledDate,
    totalCourts: courts.length,
    relevantCourts: relevantCourts.length,
    filter: courtId ? 'by courtId' : venueId ? 'by venueId' : 'all courts',
  });

  if (!relevantCourts.length) return {};

  let earliest: string | undefined;
  let latest: string | undefined;

  for (const court of relevantCourts) {
    const dateAvail = scheduledDate ? court.dateAvailability?.find((a: any) => a.date === scheduledDate) : undefined;
    const defaultAvail = court.dateAvailability?.find((a: any) => !a.date);
    const avail = dateAvail || defaultAvail;

    console.log('getTimeBounds court:', {
      courtId: court.courtId,
      courtName: court.courtName,
      usedDateSpecific: !!dateAvail,
      availStartTime: avail?.startTime,
      availEndTime: avail?.endTime,
      dateAvailabilityCount: court.dateAvailability?.length,
    });

    if (avail?.startTime && (!earliest || avail.startTime < earliest)) earliest = avail.startTime;
    if (avail?.endTime && (!latest || avail.endTime > latest)) latest = avail.endTime;
  }

  console.log('getTimeBounds result:', { earliest, latest });
  return { earliest, latest };
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

  const setTimeField = (field: 'scheduledTime' | 'startTime' | 'endTime') => {
    const schedule = matchUp?.schedule || {};
    const { earliest, latest } = getTimeBounds(matchUp);
    const defaultTime = field === 'endTime' ? latest : earliest;

    timePicker({
      time: schedule[field] || defaultTime || '',
      callback: ({ time }) => {
        const converted = tools.dateTime.convertTime(time, true) as string;
        if (!converted) return;

        if (field === 'startTime' || field === 'endTime') {
          if (earliest && converted < earliest) return;
          if (latest && converted > latest) return;
          const crossField = field === 'startTime' ? 'endTime' : 'startTime';
          const crossValue = schedule[crossField];
          if (crossValue && (field === 'startTime' ? converted > crossValue : converted < crossValue)) return;
        }

        setMatchUpSchedule({
          matchUpId: matchUp.matchUpId,
          schedule: { [field]: converted },
          callback: () => updateRow({ [field]: converted }),
        });
      },
    });
  };

  const selectOfficial = () => {
    const { participants: officials = [] } = tournamentEngine.getParticipants({
      participantFilters: { participantRoles: [OFFICIAL] },
    });

    if (!officials.length) {
      const noOfficialsEl = document.createElement('div');
      noOfficialsEl.style.cssText =
        'padding:12px; min-width:160px; text-align:center; color:var(--chc-text-secondary, #888);';
      noOfficialsEl.textContent = 'No officials found';

      const anchorEl = (target || pointerEvent.target) as HTMLElement;
      destroyOfficialTip();
      officialTip = tippy(anchorEl, {
        content: noOfficialsEl,
        theme: 'light-border',
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
      li.textContent = official.participantName;
      li.onmouseenter = () => {
        if (official.participantId !== currentOfficialId) li.style.backgroundColor = 'var(--chc-hover-bg, #f0f0f0)';
      };
      li.onmouseleave = () => {
        if (official.participantId !== currentOfficialId) li.style.backgroundColor = '';
      };
      li.onclick = (e) => {
        e.stopPropagation();
        destroyOfficialTip();
        const methods = [
          {
            method: ADD_MATCHUP_OFFICIAL,
            params: {
              matchUpId: matchUp.matchUpId,
              drawId: matchUp.drawId,
              participantId: official.participantId,
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
      theme: 'light-border',
      trigger: 'manual',
      interactive: true,
      maxWidth: 'none',
      placement: BOTTOM as any,
      appendTo: document.body,
    });
    officialTip.show();
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

  const items = [
    {
      onClick: clearSchedule,
      text: 'Clear schedule',
      hide: !hasSchedule,
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
      onClick: selectOfficial,
      text: 'Select official',
    },
    {
      onClick: () => printMatchCards({ matchUpIds: [matchUp.matchUpId], drawId: matchUp.drawId, action: 'open' }),
      text: 'Print match card',
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
