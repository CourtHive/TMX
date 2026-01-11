/**
 * Add participants to event modal with entry stage and status selection.
 * Allows selection of entry stage (main/qualifying) and status (direct acceptance/alternate/wildcard/ungrouped).
 */
import { openModal } from 'components/modals/baseModal/baseModal';
import { renderForm } from 'courthive-components';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import {
  drawDefinitionConstants,
  entryStatusConstants,
  eventConstants,
  participantConstants
} from 'tods-competition-factory';

import { NONE } from 'constants/tmxConstants';

const { ALTERNATE, WILDCARD, DIRECT_ACCEPTANCE, UNGROUPED } = entryStatusConstants;
const { MAIN, QUALIFYING } = drawDefinitionConstants;
const { INDIVIDUAL } = participantConstants;
const { TEAM, DOUBLES } = eventConstants;

type AddToEventParams = {
  callback?: (params: { entryStatus: string; entryStage: string }) => void;
  eventName?: string;
  eventType?: string;
  participantType?: string;
  participantIds?: string[];
};

export function addToEvent({ callback, eventName, eventType, participantType, participantIds }: AddToEventParams = {}): void {
  const ungroupedOnly = [TEAM, DOUBLES].includes(eventType as any) && participantType === INDIVIDUAL;

  if (!participantIds?.length) {
    tmxToast({ message: 'Nothing to do', intent: 'is-info' });
    return;
  }

  const entryStages = [
    { label: 'Main', value: MAIN, selected: true },
    { label: 'Qualifying', value: QUALIFYING }
  ];
  const stageOptions = entryStages.map(({ label, value, selected }) => ({ selected, label, value }));
  const entryStatusOptions = [
    { hide: ungroupedOnly, label: 'Direct Acceptance', value: DIRECT_ACCEPTANCE, selected: true },
    { hide: ungroupedOnly, label: 'Alternate', value: ALTERNATE },
    { hide: ungroupedOnly, label: 'Wildcard', value: WILDCARD },
    { hide: participantType === TEAM, label: 'Ungrouped', value: UNGROUPED, selected: ungroupedOnly }
  ];

  let inputs: any;

  const onClick = () => {
    const entryStatus = inputs.entryStatus.value;
    const entryStage = inputs.entryStage.value;
    if (isFunction(callback) && callback) callback({ entryStatus, entryStage });
  };

  const content = (elem: HTMLElement) =>
    (inputs = renderForm(elem, [
      {
        text: `Add ${participantIds.length} participant to ${eventName}`
      },
      {
        options: stageOptions,
        label: 'Event stage',
        field: 'entryStage',
        value: MAIN
      },
      {
        options: entryStatusOptions,
        value: DIRECT_ACCEPTANCE,
        label: 'Entry status',
        field: 'entryStatus'
      }
    ]));

  openModal({
    title: `Add to event`,
    content,
    buttons: [
      { label: 'Cancel', intent: NONE, close: true },
      { label: 'Add', intent: 'is-info', close: true, onClick }
    ]
  });
}
