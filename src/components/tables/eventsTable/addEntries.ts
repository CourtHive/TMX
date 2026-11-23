/**
 * Add entries action for events table.
 * Opens participant selection modal and adds selected entries to event.
 */
import { invalidParticipantsFromRefusal } from 'components/modals/invalidParticipantsFromRefusal';
import { invalidParticipantsModal } from 'components/modals/invalidParticipantsModal';
import { selectParticipant } from 'components/modals/selectParticipant';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { mapEntry } from 'pages/tournament/tabs/eventsTab/mapEntry';
import { positionActionConstants } from 'tods-competition-factory';
import { closeModal } from 'components/modals/baseModal/baseModal';
import { tournamentEngine } from 'services/factory/engine';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

const { ASSIGN_PARTICIPANT } = positionActionConstants;

function toParticipantId({ participantId }: any) {
  return participantId;
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
  const invalidParticipants = invalidParticipantsFromRefusal(result.context);
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
import { t } from 'i18n';

export const addEntries =
  (event: any, group: string, onRefresh?: () => void) =>
  (table: any): any => {
    const onClick = () => {
      const { entries = [], eventId, eventType } = event;
      const enteredParticipantIds = new Set((entries || []).map(({ participantId }: any) => participantId));
      const participantType =
        (event.eventType === 'TEAM' && 'TEAM') || (event.eventType === 'DOUBLES' && 'PAIR') || 'INDIVIDUAL';
      const participantsAvailable = (
        tournamentEngine.getParticipants({
          participantFilters: { participantTypes: [participantType] },
          withISO2: true,
        }).participants ?? []
      ).filter((participant: any) => !enteredParticipantIds.has(participant.participantId));

      const onSelection = ({ selected }: any) =>
        runAddEntriesSelection({ selected, group, eventId, eventType, table, onRefresh });

      const action = {
        type: ASSIGN_PARTICIPANT,
        participantsAvailable,
      };

      (selectParticipant as any)({
        title: t('modals.groupProfile.selectToAdd'),
        activeOnEnter: true,
        selectionLimit: 99,
        onSelection,
        action,
      });
    };

    return {
      label: t('segmentOverlay.addEntries'),
      class: 'addEntries',
      location: RIGHT,
      onClick,
    };
  };
