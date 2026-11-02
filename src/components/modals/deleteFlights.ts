/**
 * Delete draws or flights.
 * Deleting a generated draw asks for an audit reason (five words); flights that never had a draw ask only for
 * confirmation. With `keepFlight`, draws are deleted and their flights kept, so each can be generated again.
 */
import { deleteDrawsKeepFlightsMethod, deleteFlightMethods, deletionNeedsReason } from './flights/flightDeletion';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { confirmModal, openModal } from './baseModal/baseModal';
import { validators, renderForm } from 'courthive-components';
import { tournamentEngine } from 'services/factory/engine';
import { isDev } from 'functions/isDev';

import { NONE } from 'constants/tmxConstants';
import { t } from 'i18n';

type DeleteFlightsParams = {
  eventData?: any;
  eventId?: string;
  drawIds: string[];
  keepFlight?: boolean;
  callback?: (result: any) => void;
};

function drawNameOf({ eventId, drawId }: { eventId: string; drawId: string }): string | undefined {
  const event = tournamentEngine.q.event({ eventId });
  const draw = event?.drawDefinitions?.find((drawDefinition: any) => drawDefinition.drawId === drawId);
  const flight = tournamentEngine.q.flightProfile({ eventId })?.flights?.find((f: any) => f.drawId === drawId);
  return draw?.drawName ?? flight?.drawName;
}

export function deleteFlights(params: DeleteFlightsParams): void {
  const { eventData, drawIds, keepFlight, callback } = params;
  const eventId = params.eventId ?? eventData.eventInfo.eventId;

  const devMode = isDev();
  const postMutation = (result: any) => (callback ? callback(result) : navigateToEvent({ eventId }));
  const methodsFor = (auditData?: any) =>
    keepFlight
      ? [deleteDrawsKeepFlightsMethod({ eventId, drawIds, auditData })]
      : deleteFlightMethods({ eventId, drawIds, auditData });

  const drawName = drawIds.length === 1 ? drawNameOf({ eventId, drawId: drawIds[0] }) : undefined;
  const modalTitle = drawName ? `${t('delete')} ${drawName}` : t('ui.deleteFlights');

  // flights that never had a draw: nothing played or published, so a confirmation is enough
  const event = tournamentEngine.q.event({ eventId });
  if (!deletionNeedsReason({ event, drawIds })) {
    confirmModal({
      query: t('modals.deleteFlights.confirmUngenerated', { count: drawIds.length }),
      okAction: () => mutationRequest({ methods: methodsFor(), callback: postMutation }),
      okIntent: 'is-danger',
      title: modalTitle,
    });
    return;
  }

  let inputs: any;
  let modalHandle: any;
  const deleteAction = () => {
    const auditData = devMode ? undefined : { auditReason: inputs['drawDeletionReason'].value };
    mutationRequest({ methods: methodsFor(auditData), callback: postMutation });
  };
  const items = [
    {
      text: t(keepFlight ? 'modals.deleteFlights.keepFlightReason' : 'drawActions.deleteReason'),
      style: 'height: 2.5em; padding-right: 1em; font-size: 0.9em;',
    },
    {
      placeholder: t('ui.explanation'),
      field: 'drawDeletionReason',
      value: devMode ? 'this is only a test' : undefined,
      validator: validators.wordValidator(5),
      error: 'Five word minimum',
      autocomplete: 'on',
      focus: true,
    },
    {
      text: t('common.cannotBeUndone'),
      style: 'height: 2.5em; padding-right: 1em; font-size: 0.9em;',
    },
  ];
  const enableSubmit = ({ inputs }: any) => {
    const value = inputs['drawDeletionReason'].value;
    const isValid = validators.wordValidator(5)(value);
    modalHandle?.setButtonState('deleteDraw', { disabled: !isValid });
  };
  const relationships = [
    {
      control: 'drawDeletionReason',
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
        label: t('delete'),
        id: 'deleteDraw',
        disabled: !devMode,
        intent: 'is-danger',
        close: true,
        onClick: deleteAction,
      },
    ],
  });
}
