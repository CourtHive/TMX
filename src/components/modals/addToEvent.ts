/**
 * Add participants to event modal with entry stage and status selection.
 * Allows selection of entry stage (main/qualifying) and status (direct acceptance/alternate/wildcard/ungrouped).
 */
import { openModal } from 'components/modals/baseModal/baseModal';
import { renderForm } from 'courthive-components';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';
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
    tmxToast({ message: t('modals.addToEvent.nothingToDo'), intent: 'is-info' });
    return;
  }

  const entryStages = [
    { label: t('modals.addToEvent.main'), value: MAIN, selected: true },
    { label: t('modals.addToEvent.qualifying'), value: QUALIFYING }
  ];
  const stageOptions = entryStages.map(({ label, value, selected }) => ({ selected, label, value }));
  const entryStatusOptions = [
    { hide: ungroupedOnly, label: t('modals.addToEvent.directAcceptance'), value: DIRECT_ACCEPTANCE, selected: true },
    { hide: ungroupedOnly, label: t('modals.addToEvent.alternate'), value: ALTERNATE },
    { hide: ungroupedOnly, label: t('modals.addToEvent.wildcard'), value: WILDCARD },
    { hide: participantType === TEAM, label: t('modals.addToEvent.ungrouped'), value: UNGROUPED, selected: ungroupedOnly }
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
        label: t('modals.addToEvent.eventStage'),
        field: 'entryStage',
        value: MAIN
      },
      {
        options: entryStatusOptions,
        value: DIRECT_ACCEPTANCE,
        label: t('modals.addToEvent.entryStatus'),
        field: 'entryStatus'
      }
    ]));

  openModal({
    title: t('modals.addToEvent.title'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: NONE, close: true },
      { label: t('add'), intent: 'is-info', close: true, onClick }
    ]
  });
}
