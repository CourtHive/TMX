/**
 * A participant's issued penalties, each of which can be corrected (type and note) or withdrawn.
 * Withdrawing asks for confirmation only (CA 2026-11-01: no removal reasons).
 */
import { modifyPenaltyMethod, penaltyRows, removePenaltyMethod, type PenaltyRow } from './penaltyMethods';
import { closeModal, confirmModal, openModal } from 'components/modals/baseModal/baseModal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { logMutationError } from 'functions/logMutationError';
import { tmxToast } from 'services/notifications/tmxToast';
import { tournamentEngine } from 'services/factory/engine';
import { penaltyTypeOptions } from '../penaltyOptions';
import { renderForm } from 'courthive-components';
import { t } from 'i18n';

type PenaltiesModalArgs = { participantId: string; callback?: () => void };

const participantOf = (participantId: string) => tournamentEngine.findParticipant({ participantId })?.participant;

function matchUpContext(matchUpId?: string): string {
  if (!matchUpId) return '';
  const matchUp = tournamentEngine.allTournamentMatchUps({
    matchUpFilters: { matchUpIds: [matchUpId] },
    inContext: true,
  })?.matchUps?.[0];
  return [matchUp?.eventName, matchUp?.roundName].filter(Boolean).join(' · ');
}

function issuedDate(penalty: PenaltyRow): string {
  const when = penalty.issuedAt ?? penalty.createdAt;
  return when ? new Date(when).toLocaleString() : '';
}

function editPenalty({ penalty, onDone }: { penalty: PenaltyRow; onDone: () => void }): void {
  const content = (elem: HTMLElement) =>
    renderForm(elem, [
      {
        options: penaltyTypeOptions(),
        label: t('modals.penalty.penaltyType'),
        value: penalty.penaltyType,
        field: 'penaltyType',
      },
      { label: t('modals.penalty.notes'), value: penalty.notes ?? '', field: 'notes' },
    ]);

  const save = ({ content }: any) => {
    const penaltyType = content?.penaltyType?.value || penalty.penaltyType;
    const method = modifyPenaltyMethod({ penaltyId: penalty.penaltyId, penaltyType, notes: content?.notes?.value });
    mutationRequest({
      methods: [method],
      callback: (result: any) => {
        if (result?.success) {
          tmxToast({ message: t('modals.penalties.updated'), intent: 'is-success' });
          onDone();
        } else {
          logMutationError('modifyPenalty', result, { message: t('modals.penalties.updateFailed') });
        }
      },
    });
  };

  openModal({
    title: t('modals.penalties.edit'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      { label: t('common.save'), intent: 'is-primary', onClick: save as any, close: true },
    ],
  });
}

function removePenalty({ penalty, onDone }: { penalty: PenaltyRow; onDone: () => void }): void {
  const okAction = () =>
    mutationRequest({
      methods: [removePenaltyMethod(penalty.penaltyId)],
      callback: (result: any) => {
        if (result?.success) {
          tmxToast({ message: t('modals.penalties.removed'), intent: 'is-success' });
          onDone();
        } else {
          logMutationError('removePenalty', result, { message: t('modals.penalties.removeFailed') });
        }
      },
    });
  confirmModal({
    query: t('modals.penalties.removeConfirm', { penaltyType: t(`penalties.${penalty.penaltyType}`) }),
    title: t('modals.penalties.remove'),
    okIntent: 'is-danger',
    okAction,
  });
}

function renderRow(penalty: PenaltyRow, onChange: () => void): HTMLElement {
  const row = document.createElement('div');
  row.className = 'penalty-row';
  row.dataset.penaltyId = penalty.penaltyId;
  row.style.cssText = 'display: flex; gap: 0.75em; align-items: center; padding: 0.4em 0;';

  const text = document.createElement('div');
  text.style.cssText = 'flex: 1; min-width: 0;';
  const title = document.createElement('div');
  title.style.fontWeight = '600';
  title.textContent = t(`penalties.${penalty.penaltyType}`);
  const detail = document.createElement('div');
  detail.style.cssText = 'font-size: 0.85em; opacity: 0.8;';
  detail.textContent = [matchUpContext(penalty.matchUpId), issuedDate(penalty), penalty.notes]
    .filter(Boolean)
    .join(' — ');
  text.append(title, detail);

  const edit = document.createElement('button');
  edit.className = 'button is-small is-info is-light';
  edit.textContent = t('modals.penalties.edit');
  edit.onclick = () => editPenalty({ penalty, onDone: onChange });

  const remove = document.createElement('button');
  remove.className = 'button is-small is-danger is-light';
  remove.textContent = t('modals.penalties.remove');
  remove.onclick = () => removePenalty({ penalty, onDone: onChange });

  row.append(text, edit, remove);
  return row;
}

export function penaltiesModal({ participantId, callback }: PenaltiesModalArgs): void {
  const participant = participantOf(participantId);
  if (!penaltyRows(participant).length) {
    tmxToast({ message: t('modals.penalties.none'), intent: 'is-info' });
    return;
  }

  // a change closes this modal and reopens it from the record, so the list always shows what is stored
  const onChange = () => {
    closeModal();
    callback?.();
    if (penaltyRows(participantOf(participantId)).length) penaltiesModal({ participantId, callback });
  };

  const content = (elem: HTMLElement) => {
    for (const penalty of penaltyRows(participant)) elem.appendChild(renderRow(penalty, onChange));
  };

  openModal({
    title: `${t('modals.penalties.title')}: ${participant?.participantName ?? ''}`,
    content,
    buttons: [{ label: t('common.close'), intent: 'none', close: true }],
  });
}
