import { getMatchUpCheckInState, checkInSummary } from 'services/checkIn/checkInState';
import { buildAttester, describeAttester } from 'services/checkIn/checkInAttribution';
import { buildAttesterChooser } from 'components/popovers/checkInAttesterChooser';
import { onMutationApplied } from 'services/mutation/mutationObservers';
import { checkOutLocked } from 'services/checkIn/checkInEligibility';
import { matchUpActionConstants } from 'tods-competition-factory';
import { requestCheckInState } from 'services/checkIn/requestCheckInState';
import { logMutationError } from 'functions/logMutationError';
import { tournamentEngine } from 'services/factory/engine';
import { openCheckInDialog } from './checkInDialog';
import { t, translate } from 'i18n';

interface EditorParams {
  matchUpId: string;
  drawId: string;
  onChange?: () => void;
  onClose?: () => void;
  /** The editor stopped being busy: a request was answered, or attester entry was abandoned. */
  onSettled?: () => void;
}

export function buildCheckInEditor({ matchUpId, drawId, onChange, onSettled }: EditorParams) {
  const element = document.createElement('div');
  element.className = 'tmx-checkin-editor';
  let pending = false;
  let disposed = false;
  let choosing = false;
  let focusParticipant: string | undefined;

  // `checkedIn` is the direction of the button the operator pressed, captured at the gesture. The attester
  // chooser carries it through attribution entry, so an update that lands meanwhile cannot reverse it.
  const request = (participantId: string, checkedIn: boolean, attributedTo?: Record<string, any>) => {
    if (pending || disposed) return;
    pending = true;
    choosing = false;
    focusParticipant = participantId;
    render();
    requestCheckInState({
      matchUpId,
      drawId,
      participantId,
      checkedIn,
      attributedTo,
      callback: (result) => {
        pending = false;
        if (!result?.success) logMutationError('checkIn', result, { message: t('checkIn.toggleFailed') });
        if (disposed) return onSettled?.();
        render();
        const restored = [...element.querySelectorAll<HTMLButtonElement>('[data-participant-id]')].find(
          (button) => button.dataset.participantId === participantId,
        );
        if (restored?.disabled) element.closest<HTMLElement>('[role="dialog"]')?.focus();
        else restored?.focus();
        if (result?.success) onChange?.();
        onSettled?.();
      },
    });
  };

  const choose = (participant: any) => {
    choosing = true;
    focusParticipant = participant.participantId;
    element.replaceChildren(
      buildAttesterChooser({
        participantName: participant.participantName,
        onCancel: () => {
          choosing = false;
          render();
          onSettled?.();
        },
        onChoose: (attester) =>
          request(
            participant.participantId,
            true,
            buildAttester({ participantId: participant.participantId, attester }),
          ),
      }),
    );
    element.querySelector<HTMLElement>('button')?.focus();
  };

  const render = () => {
    if (disposed) return;
    const heldFocus = element.contains(document.activeElement);
    const matchUp = tournamentEngine.findMatchUp({ drawId, matchUpId })?.matchUp;
    const state = getMatchUpCheckInState(matchUp);
    const { validActions = [] } = tournamentEngine.matchUpActions({ drawId, matchUpId }) ?? {};
    const writable = validActions.some((action: any) => action.type === matchUpActionConstants.CHECK_IN);
    const locked = checkOutLocked(matchUp);
    // Private attribution is deliberately fetched only while the editor is open.
    const history: any[] = tournamentEngine.getMatchUpCheckInHistory({ drawId, matchUpId })?.checkIns ?? [];
    const latest = new Map(history.map((item) => [item.participantId, item]));
    element.replaceChildren();
    element.setAttribute('aria-busy', String(pending));
    const heading = document.createElement('div');
    heading.className = 'tmx-checkin-heading';
    heading.setAttribute('role', 'status');
    heading.textContent = `${t('checkIn.title')} ${checkInSummary(state)}`;
    element.appendChild(heading);
    if (!matchUp || !state.hasParticipants) {
      const empty = document.createElement('p');
      empty.textContent = t('checkIn.desk.noParticipants');
      element.appendChild(empty);
      return;
    }
    if (locked || !writable) {
      const explanation = document.createElement('p');
      explanation.textContent = t(locked ? 'checkIn.desk.checkOutLocked' : 'checkIn.desk.readOnly');
      element.appendChild(explanation);
    }
    const list = document.createElement('ul');
    list.className = 'tmx-checkin-list';
    for (const participant of state.participants) {
      const row = document.createElement('li');
      row.className = `tmx-checkin-row${participant.checkedIn ? ' is-checked-in' : ''}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tmx-checkin-person';
      button.dataset.participantId = participant.participantId;
      button.setAttribute('aria-pressed', String(participant.checkedIn));
      button.disabled = pending || !writable || (participant.checkedIn && locked);
      button.title = t(participant.checkedIn ? 'checkIn.clickToCheckOut' : 'checkIn.clickToCheckIn');
      const mark = document.createElement('span');
      mark.className = 'tmx-checkin-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = participant.checkedIn ? '✓' : '○';
      const name = document.createElement('span');
      name.textContent = participant.participantName;
      button.append(mark, name);
      const checkedIn = !participant.checkedIn;
      button.onclick = () => request(participant.participantId, checkedIn);
      row.appendChild(button);
      const attestation = latest.get(participant.participantId);
      const attribution = describeAttester(attestation?.attributedTo, translate);
      if (participant.checkedIn && attestation) {
        const detail = document.createElement('small');
        const instant = attestation.occurredAt;
        const time = instant && !Number.isNaN(Date.parse(instant)) ? new Date(instant).toLocaleString() : '';
        detail.textContent = [attribution, time].filter(Boolean).join(' · ');
        row.appendChild(detail);
      }
      if (!participant.checkedIn && writable) {
        const more = document.createElement('button');
        more.type = 'button';
        more.textContent = '…';
        more.disabled = pending;
        more.setAttribute('aria-label', `${t('checkIn.attester.action')}: ${participant.participantName}`);
        more.onclick = () => choose(participant);
        row.appendChild(more);
      }
      list.appendChild(row);
    }
    element.appendChild(list);
    if (heldFocus && !pending) {
      const buttons = [...element.querySelectorAll<HTMLButtonElement>('[data-participant-id]')];
      buttons.find((button) => button.dataset.participantId === focusParticipant)?.focus();
    }
  };
  const unsubscribe = onMutationApplied(() => {
    if (!pending && !choosing) render();
  });
  render();
  return {
    element,
    /** A request awaiting its answer, or an attester being chosen: an install now would discard or overtake it.
     * An open editor that is only showing state is not busy; it re-renders from whatever record is installed. */
    isBusy: () => !disposed && (pending || choosing),
    destroy: () => {
      disposed = true;
      unsubscribe();
    },
  };
}

export function openCheckInEditor(params: EditorParams) {
  const editor = buildCheckInEditor(params);
  const dialog = openCheckInDialog({
    content: editor.element,
    title: t('checkIn.desk.title'),
    onClose: () => {
      editor.destroy();
      params.onClose?.();
    },
  });
  return Object.assign(dialog, { isBusy: editor.isBusy });
}
