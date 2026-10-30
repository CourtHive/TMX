/**
 * Assess a penalty against a participant in a matchUp: who, which penalty code, and an optional note.
 * Offered where the factory's `matchUpActions` offers PENALTY, and written with the method that action names.
 */
import { penaltyParticipantOptions, penaltyTypeOptions } from './penaltyOptions';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { logMutationError } from 'functions/logMutationError';
import { tmxToast } from 'services/notifications/tmxToast';
import { tournamentEngine } from 'services/factory/engine';
import { renderForm } from 'courthive-components';
import { openModal } from './baseModal/baseModal';
import { t } from 'i18n';

const NO_SELECTION = '';

export function addPenaltyModal({
  action,
  sideNumber,
  callback,
}: {
  /** the factory's PENALTY action: its `method` and `payload` (drawId, matchUpId) */
  action: { method?: string; payload?: any };
  /** only this side's participants; otherwise both sides' */
  sideNumber?: number;
  callback?: () => void;
}): void {
  const { drawId, matchUpId } = action?.payload ?? {};
  // read in context from the engine, whatever row shape the caller holds: a doubles side then carries its pair's members
  const { matchUp } = (matchUpId && tournamentEngine.findMatchUp({ drawId, matchUpId, inContext: true })) || {};
  const participants = penaltyParticipantOptions(matchUp, sideNumber);
  if (!action?.method || !participants.length) return;

  const content = (elem: HTMLElement) =>
    renderForm(elem, [
      {
        options:
          participants.length === 1
            ? participants
            : [{ label: t('modals.penalty.selectParticipant'), value: NO_SELECTION }, ...participants],
        label: t('modals.penalty.participant'),
        value: participants.length === 1 ? participants[0].value : NO_SELECTION,
        field: 'participantId',
      },
      {
        options: [{ label: t('modals.penalty.selectType'), value: NO_SELECTION }, ...penaltyTypeOptions()],
        label: t('modals.penalty.penaltyType'),
        field: 'penaltyType',
        value: NO_SELECTION,
      },
      {
        label: t('modals.penalty.notes'),
        field: 'notes',
        value: '',
      },
    ]);

  const assess = ({ content }: any) => {
    const participantId = content?.participantId?.value;
    const penaltyType = content?.penaltyType?.value;
    const notes = content?.notes?.value?.trim() || undefined;
    if (!participantId || !penaltyType) {
      tmxToast({ message: t('modals.penalty.incomplete'), intent: 'is-warning' });
      return;
    }

    const params = { ...action.payload, participantIds: [participantId], penaltyType, notes };
    mutationRequest({
      methods: [{ method: action.method as string, params }],
      callback: (result: any) => {
        if (result?.success) {
          tmxToast({ message: t('modals.penalty.added'), intent: 'is-success' });
          callback?.();
        } else {
          logMutationError('addPenalty', result, { message: t('modals.penalty.failed') });
        }
      },
    });
  };

  openModal({
    title: t('draws.penalty'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      { label: t('modals.penalty.assess'), intent: 'is-primary', onClick: assess as any, close: true },
    ],
  });
}
