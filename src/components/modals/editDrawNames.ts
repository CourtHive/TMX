/**
 * Edit draw names modal with validation.
 *
 * Mirrors editStructureNames, but operates on the draws (flights) of an event
 * rather than the structures within a single draw. Renders one rename field per
 * draw (placeholder = current name) and submits a `modifyDrawName` per changed
 * draw. Renaming is the only field editable here on purpose — the full edit-draw
 * drawer would require changing far more, so both the per-draw [Actions] menu and
 * the draws-list "Rename selected" button open this focused modal.
 *
 * Scope:
 *   - pass `drawIds` to rename just those draws (list "Rename selected")
 *   - omit `drawIds` to rename every draw in the event ([Actions] menu)
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { openModal } from 'components/modals/baseModal/baseModal';
import { validators, renderForm } from 'courthive-components';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

import { MODIFY_DRAW_NAME } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

type RenamedDraw = { drawId: string; drawName: string };

export function editDrawNames({
  eventId,
  drawIds,
  callback,
}: {
  eventId: string;
  drawIds?: string[];
  callback?: (renamed: RenamedDraw[]) => void;
}): void {
  const event = tournamentEngine.q.event({ eventId });
  const allDraws = (event?.drawDefinitions || []).filter(Boolean);
  const draws = drawIds?.length ? allDraws.filter((dd: any) => drawIds.includes(dd.drawId)) : allDraws;
  if (!draws.length) return;

  const MIN_CHARS = 2;
  const options = draws.map(({ drawName, drawId }: any, index: number) => ({
    text: `${drawName}:`,
    fieldPair: {
      error: t('modals.editDrawNames.minChars'),
      validator: validators.nameValidator(MIN_CHARS),
      placeholder: drawName,
      focus: index === 0,
      field: drawId,
      id: drawId,
    },
  }));

  let inputs: any;
  let modalHandle: any;

  const onClick = () => {
    // Only submit draws whose field was actually changed to a valid, different name.
    const renamed: RenamedDraw[] = draws
      .map(({ drawId, drawName }: any) => {
        const value = inputs[drawId]?.value?.trim();
        return value && value !== drawName ? { drawId, drawName: value } : null;
      })
      .filter(Boolean) as RenamedDraw[];

    if (!renamed.length) return;

    const methods = renamed.map(({ drawId, drawName }) => ({
      params: { drawId, drawName },
      method: MODIFY_DRAW_NAME,
    }));

    const postMutation = (result: any) => {
      if (result.success) {
        tmxToast({ message: t('modals.editDrawNames.drawRenamed'), intent: 'is-success' });
        isFunction(callback) && callback?.(renamed);
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };

  const checkValid = () => {
    const nameValues = draws.map(({ drawId }: any) => inputs[drawId]?.value).filter(Boolean);
    const valid = nameValues.length && nameValues.every(validators.nameValidator(MIN_CHARS));
    modalHandle?.setButtonState('renameDraws', { disabled: !valid });
  };

  const relationships = draws.map(({ drawId }: any) => ({
    control: drawId,
    onInput: checkValid,
  }));

  const content = (elem: HTMLElement) => (inputs = renderForm(elem, options, relationships));

  modalHandle = openModal({
    title: t('modals.editDrawNames.title'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: NONE, close: true },
      { label: t('rename'), id: 'renameDraws', disabled: true, intent: 'is-info', close: true, onClick },
    ],
  });
}
