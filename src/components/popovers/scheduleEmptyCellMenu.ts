/**
 * Schedule empty cell menu popover.
 * Provides options for assigning matchUps and blocking courts at specific grid rows.
 */
import { competitionEngine, factoryConstants, eventConstants } from 'tods-competition-factory';
import { activateScheduleCellTypeAhead } from 'courthive-components';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tipster } from 'components/popovers/tipster';
import { context } from 'services/context';
import { RIGHT, UNSCHEDULED_MATCHUPS } from 'constants/tmxConstants';
import { ADD_MATCHUP_SCHEDULE_ITEMS } from 'constants/mutationConstants';

const { SINGLES, DOUBLES } = eventConstants;

function hasNoCourtAndNotBye(m: any) {
  return !m.schedule?.courtId && !m.sides?.some(isByeSide);
}

function isByeSide({ bye }: any) {
  return bye;
}

function matchUpToTypeAheadOption(m: any) {
  const side1 = m.sides?.[0]?.participant?.participantName || '';
  const side2 = m.sides?.[1]?.participant?.participantName || '';
  const vs = side1 && side2 ? `${side1} vs ${side2}` : side1 || side2 || 'TBD';
  return {
    label: `${m.eventName || ''} ${m.roundName || ''} — ${vs}`.trim(),
    value: m.matchUpId,
  };
}

function buildUnscheduledMatchUpList(scheduledDate: string | null) {
  const matchUpsWithNoCourt =
    competitionEngine
      .allCompetitionMatchUps({
        matchUpFilters: {
          matchUpStatuses: factoryConstants.upcomingMatchUpStatuses,
          matchUpTypes: [SINGLES, DOUBLES],
        },
        nextMatchUps: true,
      })
      .matchUps?.filter(hasNoCourtAndNotBye) || [];
  const unscheduled = matchUpsWithNoCourt.filter(
    (m: any) => !m.schedule?.scheduledDate || m.schedule.scheduledDate === scheduledDate,
  );
  return unscheduled.map(matchUpToTypeAheadOption);
}

function deleteUnscheduledRow(matchUpId: string) {
  const unscheduledTable = Tabulator.findTable(`#${UNSCHEDULED_MATCHUPS}`)?.[0];
  unscheduledTable?.deleteRow(matchUpId).catch(noop);
}

function noop() {}

function scheduleSelectedMatchUp({
  matchUpId,
  courtId,
  venueId,
  courtOrder,
  scheduledDate,
  updateScheduleTable,
}: {
  matchUpId: string;
  courtId: string;
  venueId: string;
  courtOrder: number;
  scheduledDate: string | null;
  updateScheduleTable?: (params: { scheduledDate: string }) => void;
}) {
  const { matchUps = [] } = competitionEngine.allCompetitionMatchUps({
    matchUpFilters: { matchUpIds: [matchUpId] },
  });
  const matchUp = matchUps[0];
  mutationRequest({
    methods: [
      {
        method: ADD_MATCHUP_SCHEDULE_ITEMS,
        params: {
          matchUpId,
          drawId: matchUp?.drawId ?? '',
          schedule: { courtId, venueId, courtOrder, scheduledDate },
          removePriorValues: true,
        },
      },
    ],
    callback: (result: any) => {
      if (!result.success) return;
      deleteUnscheduledRow(matchUpId);
      if (updateScheduleTable && scheduledDate) updateScheduleTable({ scheduledDate });
    },
  });
}

export function scheduleEmptyCellMenu({
  e,
  cell,
  updateScheduleTable,
}: {
  e: Event;
  cell: any;
  updateScheduleTable?: (params: { scheduledDate: string }) => void;
}): void {
  const rowData = cell.getRow().getData();
  const field = cell.getColumn().getDefinition().field;
  const cellData = rowData[field];

  const { courtId, courtOrder, venueId } = cellData?.schedule || {};

  // Only show menu if we have the necessary data
  if (!courtId || !courtOrder) {
    return;
  }

  const scheduledDate = context.displayed.selectedScheduleDate;

  const assignMatchUp = () => {
    activateScheduleCellTypeAhead({
      cell: cell.getElement() as HTMLElement,
      listProvider: () => buildUnscheduledMatchUpList(scheduledDate),
      onSelect: (matchUpId: string) =>
        scheduleSelectedMatchUp({
          matchUpId,
          courtId,
          venueId,
          courtOrder,
          scheduledDate,
          updateScheduleTable,
        }),
    });
  };

  const blockCourt = (rowCount: number, bookingType: string = 'BLOCKED') => {
    const methods = [
      {
        method: 'addCourtGridBooking',
        params: {
          courtId,
          scheduledDate,
          courtOrder,
          rowCount,
          bookingType,
        },
      },
    ];

    const postMutation = (result: any) => {
      // Refresh the schedule table without reloading the page
      if (result.success && updateScheduleTable && scheduledDate) {
        updateScheduleTable({ scheduledDate });
      }
    };

    mutationRequest({ methods, callback: postMutation });
  };

  const options = [
    {
      option: 'Assign matchUp',
      onClick: assignMatchUp,
    },
    {
      option: 'Block court (1 row)',
      onClick: () => blockCourt(1, 'BLOCKED'),
    },
    {
      option: 'Block court (2 rows)',
      onClick: () => blockCourt(2, 'BLOCKED'),
    },
    {
      option: 'Block court (3 rows)',
      onClick: () => blockCourt(3, 'BLOCKED'),
    },
    {
      option: 'Mark court for practice (1 row)',
      onClick: () => blockCourt(1, 'PRACTICE'),
    },
    {
      option: 'Mark court for maintenance (1 row)',
      onClick: () => blockCourt(1, 'MAINTENANCE'),
    },
  ].filter(Boolean);

  const target = e.target as HTMLElement;
  tipster({ options, target, config: { placement: RIGHT } });
}
