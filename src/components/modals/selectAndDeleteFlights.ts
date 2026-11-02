/**
 * Select and delete event flights modal.
 * Lists every draw and every flight that has no draw yet; the delete button is enabled once one is selected.
 */
import { deleteFlights } from 'components/modals/deleteFlights';
import { deletableFlights } from './flights/flightDeletion';
import { tournamentEngine } from 'services/factory/engine';
import { renderForm } from 'courthive-components';
import { openModal } from './baseModal/baseModal';

import { escapeHtml } from 'utilities/escapeHtml';
import { NONE } from 'constants/tmxConstants';
import { t } from 'i18n';

export function selectAndDeleteEventFlights({ eventData }: { eventData: any }): void {
  const eventId = eventData?.eventInfo?.eventId;
  const flights = deletableFlights({
    flightProfile: tournamentEngine.q.flightProfile({ eventId }),
    event: tournamentEngine.q.event({ eventId }),
  });

  const options = flights.map(({ drawId, drawName, generated }) => ({
    label: generated ? escapeHtml(drawName ?? '') : `${escapeHtml(drawName ?? '')} (${t('ui.notGenerated')})`,
    checkbox: true,
    field: drawId,
    id: drawId,
  }));

  let inputs: any;
  let modalHandle: any;
  const selectedDrawIds = () => flights.filter(({ drawId }) => inputs[drawId]?.checked).map(({ drawId }) => drawId);
  const onClick = () => {
    const drawIds = selectedDrawIds();
    setTimeout(() => deleteFlights({ eventData, eventId, drawIds }), 200);
  };

  const checkChecked = () => {
    modalHandle?.setButtonState('deleteSelected', { disabled: !selectedDrawIds().length });
  };

  const relationships = flights.map(({ drawId }) => ({
    onChange: checkChecked,
    control: drawId,
  }));
  const content = (elem: HTMLElement) => (inputs = renderForm(elem, options, relationships));

  modalHandle = openModal({
    title: t('ui.deleteFlights'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: NONE, close: true },
      { label: t('delete'), id: 'deleteSelected', intent: 'is-danger', disabled: true, close: true, onClick },
    ],
  });
}
