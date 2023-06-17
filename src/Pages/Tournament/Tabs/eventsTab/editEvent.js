import { mutationRequest } from 'services/mutation/mutationRequest';
import { nameValidator } from 'components/validators/nameValidator';
import { renderButtons } from 'components/renderers/renderButtons';
import { renderForm } from 'components/renderers/renderForm';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';
import {
  drawDefinitionConstants,
  entryStatusConstants,
  participantConstants,
  tournamentEngine,
  genderConstants,
  eventConstants,
  utilities
} from 'tods-competition-factory';

import { ADD_EVENT, ADD_EVENT_ENTRIES } from 'constants/mutationConstants';
import { RIGHT } from 'constants/tmxConstants';

const { DIRECT_ACCEPTANCE, UNGROUPED } = entryStatusConstants;
const { DOUBLES, SINGLES, TEAM } = eventConstants;
const { INDIVIDUAL, PAIR } = participantConstants;
const { FEMALE, MALE, MIXED } = genderConstants;
const { MAIN } = drawDefinitionConstants;

export function editEvent({ event, participants, callback } = {}) {
  const eventsCount = tournamentEngine.getEvents().events?.length || 0;
  const values = {
    eventType: event?.eventType || SINGLES,
    eventName: event?.eventName || `Event ${eventsCount + 1}`,
    gender: event?.gender || 'MIXED'
  };

  let eventTypeOptions, genderOptions;

  if (participants?.length) {
    const participantType = participants[0].participantType;
    values.eventType = (participantType === INDIVIDUAL && SINGLES) || (participantType === PAIR && DOUBLES) || TEAM;
    if (participantType === INDIVIDUAL) eventTypeOptions = [SINGLES, DOUBLES];
    if (participantType === PAIR) eventTypeOptions = [DOUBLES];
    if (participantType === TEAM) eventTypeOptions = [TEAM];

    genderOptions = [MIXED];
    const sexes =
      participantType === INDIVIDUAL &&
      utilities.unique(participants.map((p) => p.participant?.person?.sex)).filter(Boolean);
    if (sexes.length === 1) {
      sexes[0] === FEMALE && genderOptions.push(FEMALE);
      sexes[0] === MALE && genderOptions.push(MALE);
    }
  }

  const valueChange = (/*e, item*/) => {
    //
  };
  const content = (elem) =>
    renderForm(elem, [
      {
        placeholder: 'Event name',
        value: values.eventName,
        label: 'Event name',
        field: 'eventName',
        error: 'Please enter a name of at least 5 characters',
        validator: nameValidator(5),
        onChange: valueChange
      },
      {
        value: values.eventType,
        label: 'Format',
        field: 'eventType',
        options: [
          {
            hide: eventTypeOptions && !eventTypeOptions.includes(SINGLES),
            selected: values.eventType === SINGLES,
            label: 'Singles',
            value: SINGLES
          },
          {
            hide: eventTypeOptions && !eventTypeOptions.includes(DOUBLES),
            selected: values.eventType === DOUBLES,
            label: 'Doubles',
            value: DOUBLES
          },
          {
            hide: eventTypeOptions && !eventTypeOptions.includes(TEAM),
            selected: values.eventType === TEAM,
            label: 'Team',
            value: TEAM
          }
        ],
        onChange: valueChange
      },
      {
        value: values.gender,
        label: 'Gender',
        field: 'gender',
        options: [
          {
            hide: genderOptions && !genderOptions.includes(MALE),
            selected: values.gender === MALE,
            label: 'Male',
            value: MALE
          },
          {
            hide: genderOptions && !genderOptions.includes(FEMALE),
            selected: values.gender === FEMALE,
            label: 'Female',
            value: FEMALE
          },
          {
            label: 'Mixed',
            value: MIXED,
            selected: values.gender === MIXED
          }
        ],
        onChange: valueChange
      },
      {
        hide: event || participants,
        divider: true
      },
      {
        hide: event || participants,
        label: 'Participants',
        field: 'text',
        text: 'Add participants to events by selecting them in the participants table'
      }
    ]);

  const saveEvent = () => {
    const eventName = context.drawer.attributes.content.eventName.value;
    const eventType = context.drawer.attributes.content.eventType.value;
    const gender = context.drawer.attributes.content.gender.value;

    const postMutation = (result) => {
      if (result.success) {
        if (isFunction(callback)) callback(result);
      } else {
        console.log({ result });
      }
    };

    const eventId = utilities.UUID();
    const methods = [{ method: ADD_EVENT, params: { event: { eventId, eventName, eventType, gender } } }];
    if (participants?.length) {
      const participantIds = participants.map(({ participantId }) => participantId);
      const entryStatus = eventType === DOUBLES ? UNGROUPED : DIRECT_ACCEPTANCE;
      const method = {
        params: { eventId, participantIds, entryStatus, entryStage: MAIN },
        method: ADD_EVENT_ENTRIES
      };
      methods.push(method);
    }
    mutationRequest({ methods, callback: postMutation });
  };

  const footer = (elem, close) =>
    renderButtons(
      elem,
      [
        { label: 'Cancel', close: true },
        { label: 'Save', onClick: saveEvent, close: true, intent: 'is-info' }
      ],
      close
    );

  const title = event?.eventId ? 'Edit event' : 'Add event';
  context.drawer.open({
    title: `<b style='larger'>${title}</b>`,
    context: 'tournament',
    onClose: callback,
    width: '300px',
    side: RIGHT,
    content,
    footer
  });
}
