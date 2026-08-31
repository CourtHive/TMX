/**
 * Reset draw definitions modal with audit reason.
 * Validates word count and resets draw to initial state with mutation.
 */
import { renderEventsTab } from 'pages/tournament/tabs/eventsTab/eventsTab';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { openModal } from 'components/modals/baseModal/baseModal';
import { validators, renderForm } from 'courthive-components';
import { isDev } from 'functions/isDev';

// constants
import { RESET_DRAW_DEFINITION } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';
import { t } from 'i18n';

export function resetDraws({ eventData, drawIds }: { eventData: any; drawIds: string[] }): void {
  const eventId = eventData.eventInfo.eventId;
  const devMode = isDev();

  const drawName =
    drawIds.length === 1 && eventData?.drawsData?.find((data: any) => drawIds.includes(data.drawId)).drawName;
  const modalTitle = drawName ? `Reset ${drawName}` : 'Reset draws';

  let inputs: any;
  let modalHandle: any;
  const resetAction = () => {
    const auditData = devMode ? undefined : { auditReason: inputs['drawResetReason'].value };
    const removeAssignments = inputs['removeAssignments']?.checked ?? false;
    const methods = drawIds.map((drawId) => ({
      params: { eventId, drawId, auditData, removeAssignments, removeScheduling: true },
      method: RESET_DRAW_DEFINITION,
    }));
    const postMutation = (result: any) => {
      if (result.success) {
        renderEventsTab({ eventId, drawId: drawIds[0], renderDraw: true });
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };
  const items = [
    {
      text: t('drawActions.resetReason'),
      style: 'height: 2.5em; padding-right: 1em; font-size: 0.9em;',
    },
    {
      placeholder: t('ui.explanation'),
      field: 'drawResetReason',
      value: devMode ? 'this is only a test' : undefined,
      validator: validators.wordValidator(5),
      error: 'Five word minimum',
      autocomplete: 'on',
      focus: true,
    },
    {
      label: t('drawActions.removeAssignments'),
      field: 'removeAssignments',
      id: 'removeAssignments',
      checkbox: true,
    },
    {
      text: t('common.cannotBeUndone'),
      style: 'height: 2.5em; padding-right: 1em; font-size: 0.9em;',
    },
  ];
  const enableSubmit = ({ inputs }: any) => {
    const value = inputs['drawResetReason'].value;
    const isValid = validators.wordValidator(5)(value);
    modalHandle?.setButtonState('resetDraw', { disabled: !isValid });
  };
  const relationships = [
    {
      control: 'drawResetReason',
      onInput: enableSubmit,
    },
  ];
  const content = (elem: HTMLElement) => (inputs = renderForm(elem, items, relationships));

  modalHandle = openModal({
    title: modalTitle,
    content,
    buttons: [
      { label: t('common.cancel'), intent: NONE, close: true },
      {
        label: t('ui.reset'),
        id: 'resetDraw',
        disabled: !devMode,
        intent: 'is-warning',
        close: true,
        onClick: resetAction,
      },
    ],
  });
}
