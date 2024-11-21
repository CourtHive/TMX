import { mutationRequest } from 'services/mutation/mutationRequest';
import { nameValidator } from 'components/validators/nameValidator';
import { renderButtons } from 'components/renderers/renderButtons';
import { renderForm } from 'components/renderers/renderForm';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';
import {
  drawDefinitionConstants,
  entryStatusConstants,
  participantConstants,
  tournamentEngine,
  genderConstants,
  eventConstants,
  tools,
} from 'tods-competition-factory';

import { ADD_EVENT, ADD_EVENT_ENTRIES, MODIFY_EVENT } from 'constants/mutationConstants';
import { RIGHT } from 'constants/tmxConstants';

const { ALTERNATE, DIRECT_ACCEPTANCE, UNGROUPED, STRUCTURE_SELECTED_STATUSES } = entryStatusConstants;
const { ANY, FEMALE, MALE, MIXED } = genderConstants;
const { DOUBLES, SINGLES, TEAM } = eventConstants;
const { INDIVIDUAL, PAIR } = participantConstants;
const { MAIN } = drawDefinitionConstants;

export function editEvent({ table, event, participants, callback } = {}) {
  const eventsCount = tournamentEngine.getEvents().events?.length || 0;
  const tournamentInfo = tournamentEngine.getTournamentInfo()?.tournamentInfo || {};
  const values = {
    eventName: event?.eventName || `Event ${eventsCount + 1}`,
    startDate: event?.startDate ?? tournamentInfo.startDate,
    endDate: event?.endDate ?? tournamentInfo.endDate,
    ageCategoryCode: event?.category?.ageCategoryCode,
    eventType: event?.eventType || SINGLES,
    gender: event?.gender || ANY,
  };

  const enteredParticipantIds = event?.entries
    ?.filter(({ entryStatus }) => [...STRUCTURE_SELECTED_STATUSES, ALTERNATE].includes(entryStatus))
    .map(({ participantId }) => participantId);

  const enteredParticipants = enteredParticipantIds
    ? tournamentEngine.getParticipants({
        participantFilters: { participantIds: enteredParticipantIds },
        withIndividualParticipants: true,
      }).participants
    : [];

  let eventTypeOptions, genderOptions;

  const participantType = participants?.[0].participantType;

  if (participants?.length) {
    values.eventType = (participantType === INDIVIDUAL && SINGLES) || (participantType === PAIR && DOUBLES) || TEAM;
    if (participantType === INDIVIDUAL) eventTypeOptions = [SINGLES, DOUBLES, TEAM];
    if (participantType === PAIR) eventTypeOptions = [DOUBLES];
    if (participantType === TEAM) eventTypeOptions = [TEAM];

    const sexes = participantType === INDIVIDUAL && tools.unique(participants.map((p) => p.participant?.person?.sex));

    genderOptions = [ANY];
    if (sexes.length === 1) {
      sexes[0] === FEMALE && genderOptions.push(FEMALE);
      sexes[0] === MALE && genderOptions.push(MALE);
      values.gender = sexes[0];
    } else if (sexes.length > 1) {
      genderOptions.push(MIXED);
    }
  }

  const enteredParticipantGenders = [];
  const enteredParticipantTypes = enteredParticipants.reduce((types, participant) => {
    const genders = participant.person?.sex
      ? [participant.person.sex]
      : participant.individualParticpants?.map((p) => p.person?.sex) || [];
    enteredParticipantGenders.push(genders);
    return !types.includes(participant.participantType) ? types.concat(participant.participantType) : types;
  }, []);

  const participantAgeCategories = [];
  for (const participant of [...enteredParticipants, ...(participants || []).map((p) => p.participant)].filter(
    (p) => p,
  )) {
    const rankings = participant.timeItems
      ?.filter(({ itemType }) => itemType?.startsWith(`SCALE.RANKING.${values.eventType}`))
      .map(({ itemType }) => itemType?.split('.').pop());
    participantAgeCategories.push(rankings);
  }
  const categories = tools.unique(...participantAgeCategories);
  if (categories.length === 1) values.ageCategoryCode = categories[0];

  if (enteredParticipantGenders.length) {
    genderOptions = [ANY];
    if (event.gender && !event.gender === ANY) genderOptions.push(event.gender);
    if (event.eventType === DOUBLES && !genderOptions.includes(MIXED)) genderOptions.push(MIXED);
    const uniqueEnteredGenders = tools.unique(...enteredParticipantGenders);
    if (uniqueEnteredGenders.length === 1 && !genderOptions.includes(uniqueEnteredGenders[0])) {
      genderOptions.push(...uniqueEnteredGenders);
    }
  } else if (event) {
    genderOptions = [ANY, MALE, MIXED, FEMALE];
  }

  const valueChange = (/*e, item*/) => {
    //
  };

  const relationships = [
    {
      fields: ['startDate', 'endDate'],
      minDate: tournamentInfo.startDate,
      maxDate: tournamentInfo.endDate,
      dateRange: true,
    },
  ];

  const content = (elem) =>
    renderForm(
      elem,
      [
        {
          error: 'minimum of 5 characters',
          validator: nameValidator(5),
          placeholder: 'Event name',
          value: values.eventName,
          onChange: valueChange,
          selectOnFocus: true,
          label: 'Event name',
          field: 'eventName',
          focus: true,
        },
        {
          disabled: enteredParticipantTypes.length,
          value: values.eventType,
          field: 'eventType',
          label: 'Format',
          options: [
            {
              hide: eventTypeOptions && !eventTypeOptions.includes(SINGLES),
              selected: values.eventType === SINGLES,
              label: 'Singles',
              value: SINGLES,
            },
            {
              hide: eventTypeOptions && !eventTypeOptions.includes(DOUBLES),
              selected: values.eventType === DOUBLES,
              label: 'Doubles',
              value: DOUBLES,
            },
            {
              hide: eventTypeOptions && !eventTypeOptions.includes(TEAM),
              selected: values.eventType === TEAM,
              label: 'Team',
              value: TEAM,
            },
          ],
          onChange: valueChange,
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
              value: MALE,
            },
            {
              hide: genderOptions && !genderOptions.includes(FEMALE),
              selected: values.gender === FEMALE,
              label: 'Female',
              value: FEMALE,
            },
            {
              selected: values.gender === ANY,
              label: 'Any',
              value: ANY,
            },
            {
              hide: genderOptions && !genderOptions.includes(MIXED),
              selected: values.gender === MIXED,
              label: 'Mixed',
              value: MIXED,
            },
          ],
          onChange: valueChange,
        },
        {
          value: values.ageCategoryCode,
          field: 'ageCategoryCode',
          label: 'Category',
          options: [
            {
              selected: ['', undefined].includes(values.ageCategoryCode),
              label: '------------',
              value: '',
            },
            {
              selected: values.ageCategoryCode === 'U10',
              label: '10 and Under',
              value: 'U10',
            },
            {
              selected: values.ageCategoryCode === 'U12',
              label: '12 and Under',
              value: 'U12',
            },
            {
              selected: values.ageCategoryCode === 'U14',
              label: '14 and Under',
              value: 'U14',
            },
            {
              selected: values.ageCategoryCode === 'U16',
              label: '16 and Under',
              value: 'U16',
            },
            {
              selected: values.ageCategoryCode === 'U18',
              label: '18 and Under',
              value: 'U18',
            },
            {
              label: 'Custom',
              value: 'custom',
              disabled: true,
            },
          ],
          onChange: valueChange,
        },
        {
          value: event?.startDate ?? tournamentInfo.startDate,
          placeholder: 'YYYY-MM-DD',
          label: 'Start date',
          field: 'startDate',
        },
        {
          value: event?.endDate ?? tournamentInfo.endDate,
          placeholder: 'YYYY-MM-DD',
          label: 'End date',
          field: 'endDate',
        },
        {
          hide: event || participants,
          divider: true,
        },
      ],
      relationships,
    );

  const saveEvent = () => {
    const ageCategoryCode = context.drawer.attributes.content.ageCategoryCode.value;
    const eventName = context.drawer.attributes.content.eventName.value;
    const eventType = context.drawer.attributes.content.eventType.value;
    const startDate = context.drawer.attributes.content.startDate.value;
    const endDate = context.drawer.attributes.content.endDate.value;
    const gender = context.drawer.attributes.content.gender.value;

    const eventUpdates = { eventName, eventType, gender, startDate, endDate };

    if (ageCategoryCode && ageCategoryCode !== 'custom') {
      eventUpdates.category = { ...event?.category, ageCategoryCode };
    }

    const postMutation = (result) => {
      table?.deselectRow();
      if (result.success) {
        const event = result.results?.[0]?.event;
        if (isFunction(callback)) callback({ ...result, event, eventUpdates });
      } else if (result.error) {
          tmxToast({ intent: 'is-warning', message: result.error?.message || 'Error' });
          if (isFunction(callback)) {
            callback();
          }
        }
    };

    if (event) {
      const eventId = event.eventId;
      const methods = [{ method: MODIFY_EVENT, params: { eventId, eventUpdates } }];
      mutationRequest({ methods, callback: postMutation });
    } else {
      const category = ageCategoryCode && ageCategoryCode !== 'custom' ? { ageCategoryCode } : undefined;
      const eventId = tools.UUID();
      const methods = [
        {
          params: { event: { category, eventId, eventName, eventType, gender, startDate, endDate } },
          method: ADD_EVENT,
        },
      ];

      if (participants?.length) {
        const participantIds = participants.map(({ participantId }) => participantId);
        const entryStatus =
          participantType === INDIVIDUAL && [DOUBLES, TEAM].includes(eventType) ? UNGROUPED : DIRECT_ACCEPTANCE;
        const method = {
          params: { eventId, participantIds, entryStatus, entryStage: MAIN },
          method: ADD_EVENT_ENTRIES,
        };
        methods.push(method);
      }
      mutationRequest({ methods, callback: postMutation });
    }
  };

  const footer = (elem, close) =>
    renderButtons(
      elem,
      [
        { label: 'Cancel', onClick: () => table?.deselectRow(), close: true },
        { label: 'Save', onClick: saveEvent, close: true, intent: 'is-info' },
      ],
      close,
    );

  const title = event?.eventId ? 'Edit event' : 'Add event';
  context.drawer.open({
    title: `<b style='larger'>${title}</b>`,
    onClose: () => table?.deselectRow(),
    width: '300px',
    side: RIGHT,
    content,
    footer,
  });
}
