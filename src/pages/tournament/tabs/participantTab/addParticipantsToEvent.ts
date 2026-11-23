/**
 * Add participants to events with entry status configuration.
 * Filters out participants already in the event and prompts for entry status/stage.
 */
import { invalidParticipantsFromRefusal } from 'components/modals/invalidParticipantsFromRefusal';
import { invalidParticipantsModal } from 'components/modals/invalidParticipantsModal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { closeModal } from 'components/modals/baseModal/baseModal';
import { addToEvent } from 'components/modals/addToEvent';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

import { ADD_EVENT_ENTRIES } from 'constants/mutationConstants';
import { tmxToast } from 'services/notifications/tmxToast';

type AddParticipantsToEventParams = {
  event: any;
  participantType: string;
  table: any;
  callback?: () => void;
};

export function addParticipantsToEvent({
  event,
  participantType,
  table,
  callback,
}: AddParticipantsToEventParams): void {
  const selected = table.getSelectedData();
  const activeIds = new Set(table.getData('active').map((a: any) => a.participantId));
  const { eventId, eventName, eventType } = event;
  const participantIds = selected
    .filter((p: any) => activeIds.has(p.participantId))
    .filter((p: any) => !p.events.map((e: any) => e.eventId).includes(eventId))
    .map(({ participantId }: any) => participantId);

  // Check if all selected participants are already in the event
  if (!participantIds.length && selected.length) {
    tmxToast({
      message: t('pages.participants.addToEvent.alreadyInEvent', { eventName }),
      intent: 'is-info',
    });
    return;
  }
  const postAdd = ({ entryStatus, entryStage }: any = {}) => {
    table.deselectRow();
    const methods = [
      {
        params: { eventId, participantIds, entryStatus, entryStage, enforceGender: true, enforceCategory: true },
        method: ADD_EVENT_ENTRIES,
      },
    ];
    const postMutation = (result: any) => {
      if (result.success) {
        isFunction(callback) && callback?.();
      } else {
        const invalidParticipants = invalidParticipantsFromRefusal(result.context);

        if (invalidParticipants.length) {
          // Close the "Add to event" modal before opening invalid participants modal
          closeModal();
          // Small delay to allow the first modal to fully close
          setTimeout(() => {
            invalidParticipantsModal({ invalidParticipants });
          }, 100);
        } else if (result.misMatchedGender) {
          tmxToast({ intent: 'is-danger', message: t('pages.participants.addToEvent.invalidGender') });
        } else {
          tmxToast({
            intent: 'is-danger',
            message: result.error?.message || t('pages.participants.addToEvent.errorAdding'),
          });
        }
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };
  addToEvent({ callback: postAdd, eventName, participantType, eventType, participantIds } as any);
}
