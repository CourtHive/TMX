/**
 * Add entries action for events table.
 * Opens participant selection modal and adds selected entries to event.
 */
import { positionActionConstants, tournamentEngine } from 'tods-competition-factory';
import { selectParticipant } from 'components/modals/selectParticipant';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { mapEntry } from 'pages/tournament/tabs/eventsTab/mapEntry';
import { closeModal } from 'components/modals/baseModal/baseModal';
import { invalidParticipantsModal } from 'components/modals/invalidParticipantsModal';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

const { ASSIGN_PARTICIPANT } = positionActionConstants;

function toParticipantId({ participantId }: any) {
  return participantId;
}

function categoryRejectionToInvalid(p: any) {
  return {
    participantId: p.participantId,
    participantName: p.participantName,
    errors: [
      {
        error: p.rejectionReasons[0]?.type || 'categoryRejection',
        reason: p.rejectionReasons[0]?.reason,
      },
    ],
  };
}

function mismatchedGenderToInvalid(expectedGender: string) {
  return (p: any) => ({
    participantId: p.participantId,
    errors: [{ error: 'mismatchedGender', sex: p.sex, expectedGender }],
  });
}

function invalidAgeToInvalid(p: any) {
  return { participantId: p.participantId, errors: [{ error: 'invalidAge', ...p }] };
}

function invalidRatingToInvalid(p: any) {
  return { participantId: p.participantId, errors: [{ error: 'invalidRating', ...p }] };
}

function collectInvalidParticipants(ctx: any): any[] {
  const invalid: any[] = [];
  if (!ctx) return invalid;
  if (ctx.categoryRejections?.length) invalid.push(...ctx.categoryRejections.map(categoryRejectionToInvalid));
  if (ctx.mismatchedGender?.length) invalid.push(...ctx.mismatchedGender.map(mismatchedGenderToInvalid(ctx.gender)));
  if (ctx.invalidAge?.length) invalid.push(...ctx.invalidAge.map(invalidAgeToInvalid));
  if (ctx.invalidRating?.length) invalid.push(...ctx.invalidRating.map(invalidRatingToInvalid));
  return invalid;
}

function showInvalidParticipantsLater(invalidParticipants: any[]) {
  invalidParticipantsModal({ invalidParticipants });
}

function runAddEntriesSelection({
  selected,
  group,
  eventId,
  eventType,
  table,
  onRefresh,
}: {
  selected: any[];
  group: string;
  eventId: string;
  eventType: string;
  table: any;
  onRefresh?: () => void;
}) {
  if (!selected?.length) return;
  const participantIds = selected.map(toParticipantId);
  const entryStage = group === QUALIFYING ? 'QUALIFYING' : 'MAIN';
  const entryStatus = 'DIRECT_ACCEPTANCE';
  const methods = [
    {
      params: { eventId, participantIds, entryStatus, entryStage, enforceGender: true, enforceCategory: true },
      method: ADD_EVENT_ENTRIES,
    },
  ];
  mutationRequest({
    methods,
    callback: (result: any) =>
      handleAddEntriesResult(result, {
        participantIds,
        entryStage,
        entryStatus,
        eventType,
        eventId,
        table,
        onRefresh,
      }),
  });
}

function handleAddEntriesResult(
  result: any,
  ctx: {
    participantIds: string[];
    entryStage: string;
    entryStatus: string;
    eventType: string;
    eventId: string;
    table: any;
    onRefresh?: () => void;
  },
) {
  if (result.success) {
    applyAddEntriesSuccess(ctx);
    return;
  }
  const invalidParticipants = collectInvalidParticipants(result.context);
  if (invalidParticipants.length) {
    closeModal();
    setTimeout(() => showInvalidParticipantsLater(invalidParticipants), 100);
  }
}

function applyAddEntriesSuccess({
  participantIds,
  entryStage,
  entryStatus,
  eventType,
  eventId,
  table,
  onRefresh,
}: {
  participantIds: string[];
  entryStage: string;
  entryStatus: string;
  eventType: string;
  eventId: string;
  table: any;
  onRefresh?: () => void;
}) {
  const unifiedTable = context.tables['unifiedEntries'];
  if (unifiedTable && isFunction(unifiedTable._unifiedRefresh)) {
    unifiedTable._unifiedRefresh();
    return;
  }
  if (onRefresh) {
    onRefresh();
    return;
  }
  const { participants, derivedDrawInfo } = tournamentEngine.getParticipants({
    participantFilters: { participantIds },
    withIndividualParticipants: true,
    withScaleValues: true,
    withDraws: true,
  });
  const newEntries = participantIds.map((participantId: string) =>
    (mapEntry as any)({
      entry: { participantId, entryStage, entryStatus },
      derivedDrawInfo,
      participants,
      eventType,
      eventId,
    }),
  );
  table.addRow(newEntries);
}

import { ADD_EVENT_ENTRIES } from 'constants/mutationConstants';
import { QUALIFYING, RIGHT } from 'constants/tmxConstants';

export const addEntries =
  (event: any, group: string, onRefresh?: () => void) =>
  (table: any): any => {
    const onClick = () => {
      const { entries = [], eventId, eventType } = event;
      const enteredParticipantIds = new Set((entries || []).map(({ participantId }: any) => participantId));
      const participantType =
        (event.eventType === 'TEAM' && 'TEAM') || (event.eventType === 'DOUBLES' && 'PAIR') || 'INDIVIDUAL';
      const participantsAvailable = tournamentEngine
        .getParticipants({
          inContext: true,
          participantFilters: { participantTypes: [participantType] },
          withISO2: true,
        })
        .participants.filter((participant: any) => !enteredParticipantIds.has(participant.participantId));

      const onSelection = ({ selected }: any) =>
        runAddEntriesSelection({ selected, group, eventId, eventType, table, onRefresh });

      const action = {
        type: ASSIGN_PARTICIPANT,
        participantsAvailable,
      };

      (selectParticipant as any)({
        title: 'Select participants to add',
        activeOnEnter: true,
        selectionLimit: 99,
        onSelection,
        action,
      });
    };

    return {
      label: 'Add entries',
      class: 'addEntries',
      location: RIGHT,
      onClick,
    };
  };
