/**
 * Event editor drawer for creating and modifying events.
 * Handles event configuration including name, type, gender, category, and dates.
 */
import { getCategoryModal, renderButtons, renderForm, validators } from 'courthive-components';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';
import { t } from 'i18n';
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

export function editEvent({
  table,
  event,
  participants,
  callback,
}: { table?: any; event?: any; participants?: any[]; callback?: (result: any) => void } = {}): void {
  const eventsCount = tournamentEngine.getEvents().events?.length || 0;
  const tournamentInfo = tournamentEngine.getTournamentInfo()?.tournamentInfo || {};
  const values: any = {
    eventName: event?.eventName || `Event ${eventsCount + 1}`,
    startDate: event?.startDate ?? tournamentInfo.startDate,
    endDate: event?.endDate ?? tournamentInfo.endDate,
    ageCategoryCode: event?.category?.ageCategoryCode,
    eventType: event?.eventType || SINGLES,
    gender: event?.gender || ANY,
  };

  const enteredParticipantIds = event?.entries
    ?.filter(({ entryStatus }: any) => [...STRUCTURE_SELECTED_STATUSES, ALTERNATE].includes(entryStatus))
    .map(({ participantId }: any) => participantId);

  const enteredParticipants = enteredParticipantIds
    ? tournamentEngine.getParticipants({
        participantFilters: { participantIds: enteredParticipantIds },
        withIndividualParticipants: true,
      }).participants
    : [];

  let eventTypeOptions: string[] | undefined;
  let genderOptions: string[] | undefined;

  const participantType = participants?.[0].participantType;

  if (participants?.length) {
    values.eventType = (participantType === INDIVIDUAL && SINGLES) || (participantType === PAIR && DOUBLES) || TEAM;
    if (participantType === INDIVIDUAL) eventTypeOptions = [SINGLES, DOUBLES, TEAM];
    if (participantType === PAIR) eventTypeOptions = [DOUBLES];
    if (participantType === TEAM) eventTypeOptions = [TEAM];

    const sexes =
      participantType === INDIVIDUAL && tools.unique(participants.map((p: any) => p.participant?.person?.sex));

    genderOptions = [ANY];
    if (sexes.length === 1) {
      sexes[0] === FEMALE && genderOptions.push(FEMALE);
      sexes[0] === MALE && genderOptions.push(MALE);
      values.gender = sexes[0];
    } else if (sexes.length > 1) {
      genderOptions.push(MIXED);
    }
  }

  const enteredParticipantGenders: any[] = [];
  const enteredParticipantTypes = enteredParticipants.reduce((types: any[], participant: any) => {
    const genders =
      participant.participantType === INDIVIDUAL
        ? [participant.person.sex]
        : tools.unique(participant.individualParticipants?.map((p: any) => p.person?.sex) || []);
    enteredParticipantGenders.push(genders);
    return types.includes(participant.participantType) ? types : types.concat(participant.participantType);
  }, []);

  const participantAgeCategories: any[] = [];
  for (const participant of [...enteredParticipants, ...(participants || []).map((p: any) => p.participant)].filter(
    Boolean,
  )) {
    const rankings = participant.timeItems
      ?.filter(({ itemType }: any) => itemType?.startsWith(`SCALE.RANKING.${values.eventType}`))
      .map(({ itemType }: any) => itemType?.split('.').pop());
    participantAgeCategories.push(rankings);
  }
  const categories = tools.unique(...participantAgeCategories);
  if (categories.length === 1) values.ageCategoryCode = categories[0];

  if (enteredParticipantGenders.length) {
    genderOptions = [ANY];
    if (event.gender && event.gender !== ANY) genderOptions.push(event.gender);
    if (event.eventType === DOUBLES && !genderOptions.includes(MIXED)) genderOptions.push(MIXED);
    const uniqueEnteredGenders = tools.unique(...enteredParticipantGenders);
    if (uniqueEnteredGenders.length === 1 && !genderOptions.includes(uniqueEnteredGenders[0])) {
      genderOptions.push(...uniqueEnteredGenders);
    }
  } else if (event) {
    genderOptions = [ANY, MALE, MIXED, FEMALE];
  }

  // Get tournament categories for dropdown
  const tournamentRecord = tournamentEngine.getTournament().tournamentRecord;
  const tournamentCategories = tournamentRecord?.tournamentCategories || [];

  // Build category options from tournament categories
  const buildCategoryOptions = () => {
    const options = [
      {
        selected: ['', undefined].includes(values.ageCategoryCode),
        label: '------------',
        value: '',
      },
    ];

    // Add tournament-defined categories first
    if (tournamentCategories.length > 0) {
      tournamentCategories.forEach((cat: any) => {
        const label = cat.ageCategoryCode ? `${cat.categoryName} (${cat.ageCategoryCode})` : cat.categoryName;
        options.push({
          selected: values.ageCategoryCode === (cat.ageCategoryCode || cat.categoryName),
          label,
          value: cat.ageCategoryCode || cat.categoryName,
        });
      });
    } else {
      // Fallback to default categories if tournament has none defined
      options.push(
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
      );
    }

    // Always add Custom option at the end
    options.push({
      selected: false,
      label: t('pages.events.editEvent.custom'),
      value: 'custom',
    });

    return options;
  };

  const valueChange = () => {
    // Placeholder for future functionality
  };

  const relationships = [
    {
      fields: ['startDate', 'endDate'],
      minDate: tournamentInfo.startDate,
      maxDate: tournamentInfo.endDate,
      dateRange: true,
    },
  ];

  // Store formInputs for programmatic access
  let formInputs: any;

  const content = (elem: HTMLElement) => {
    formInputs = renderForm(
      elem,
      [
        {
          error: t('pages.events.editEvent.eventNameError'),
          validator: validators.nameValidator(5),
          placeholder: t('pages.events.editEvent.eventNamePlaceholder'),
          value: values.eventName,
          onChange: valueChange,
          selectOnFocus: true,
          label: t('pages.events.editEvent.eventNameLabel'),
          field: 'eventName',
          focus: true,
        },
        {
          disabled: enteredParticipantTypes.length,
          value: values.eventType,
          field: 'eventType',
          label: t('fmt'),
          options: [
            {
              hide: eventTypeOptions && !eventTypeOptions.includes(SINGLES),
              selected: values.eventType === SINGLES,
              label: t('sgl'),
              value: SINGLES,
            },
            {
              hide: eventTypeOptions && !eventTypeOptions.includes(DOUBLES),
              selected: values.eventType === DOUBLES,
              label: t('dbl'),
              value: DOUBLES,
            },
            {
              hide: eventTypeOptions && !eventTypeOptions.includes(TEAM),
              selected: values.eventType === TEAM,
              label: t('team'),
              value: TEAM,
            },
          ],
          onChange: valueChange,
        },
        {
          value: values.gender,
          label: t('gdr'),
          field: 'gender',
          options: [
            {
              hide: genderOptions && !genderOptions.includes(MALE),
              selected: values.gender === MALE,
              label: t('genders.male'),
              value: MALE,
            },
            {
              hide: genderOptions && !genderOptions.includes(FEMALE),
              selected: values.gender === FEMALE,
              label: t('genders.female'),
              value: FEMALE,
            },
            {
              selected: values.gender === ANY,
              label: t('pages.events.editEvent.any'),
              value: ANY,
            },
            {
              hide: genderOptions && !genderOptions.includes(MIXED),
              selected: values.gender === MIXED,
              label: t('genders.mixed'),
              value: MIXED,
            },
          ],
          onChange: valueChange,
        },
        {
          value: values.ageCategoryCode,
          field: 'ageCategoryCode',
          label: t('cat'),
          options: buildCategoryOptions(),
          onChange: valueChange,
        },
        {
          value: event?.startDate ?? tournamentInfo.startDate,
          placeholder: 'YYYY-MM-DD',
          label: t('start'),
          field: 'startDate',
        },
        {
          value: event?.endDate ?? tournamentInfo.endDate,
          placeholder: 'YYYY-MM-DD',
          label: t('end'),
          field: 'endDate',
        },
        {
          hide: event || participants,
          divider: true,
        },
      ],
      relationships,
    );
    return formInputs;
  };

  const saveEvent = () => {
    const ageCategoryCode = context.drawer.attributes.content.ageCategoryCode.value;
    const eventName = context.drawer.attributes.content.eventName.value;
    const startDate = context.drawer.attributes.content.startDate.value;

    // Validation
    if (!eventName || eventName.length < 5) {
      tmxToast({ message: t('pages.events.editEvent.eventNameRequired'), intent: 'is-danger' });
      return;
    }

    // Check if Custom category is selected
    if (ageCategoryCode === 'custom') {
      const setCategory = (categoryResult: any) => {
        if (categoryResult?.ageCategoryCode) {
          // Phase 3 & 4: Add custom category to tournament categories
          const existing = tournamentRecord?.tournamentCategories || [];

          // Check if category already exists
          const isDuplicate = existing.some(
            (cat: any) =>
              cat.ageCategoryCode === categoryResult.ageCategoryCode ||
              cat.categoryName === categoryResult.categoryName,
          );

          if (!isDuplicate) {
            // Add new category to tournament
            const updatedCategories = [...existing, categoryResult];
            const result = tournamentEngine.setTournamentCategories({ categories: updatedCategories });

            if (result.success) {
              // Phase 2: Add category to dropdown programmatically
              if (formInputs?.ageCategoryCode) {
                const label = categoryResult.ageCategoryCode
                  ? `${categoryResult.categoryName} (${categoryResult.ageCategoryCode})`
                  : categoryResult.categoryName;
                const value = categoryResult.ageCategoryCode || categoryResult.categoryName;

                // Add new option before "Custom"
                const customIndex = formInputs.ageCategoryCode.options.length - 1;
                const newOption = new Option(label, value);
                formInputs.ageCategoryCode.options.add(newOption, customIndex);

                // Select the new option
                formInputs.ageCategoryCode.value = value;
              }
            } else {
              tmxToast({
                message: t('pages.events.editEvent.categorySaveWarning'),
                intent: 'is-warning',
              });
            }
          }

          // Update the drawer attribute and proceed with save
          context.drawer.attributes.content.ageCategoryCode.value = categoryResult.ageCategoryCode;
          proceedWithSave(categoryResult);
        }
      };

      getCategoryModal({
        existingCategory: event?.category || {},
        editorConfig: {
          defaultConsideredDate: startDate || tournamentInfo.startDate,
        },
        callback: setCategory,
      });
      return;
    }

    proceedWithSave();
  };

  const proceedWithSave = (category?: any) => {
    const ageCategoryCode = category?.ageCategoryCode || context.drawer.attributes.content.ageCategoryCode.value;
    const eventName = context.drawer.attributes.content.eventName.value;
    const eventType = context.drawer.attributes.content.eventType.value;
    const startDate = context.drawer.attributes.content.startDate.value;
    const endDate = context.drawer.attributes.content.endDate.value;
    const gender = context.drawer.attributes.content.gender.value;

    const eventUpdates: any = { eventName, eventType, gender, startDate, endDate };

    if (category) {
      eventUpdates.category = category;
    } else if (ageCategoryCode && ageCategoryCode !== 'custom') {
      eventUpdates.category = { ...event?.category, ageCategoryCode };
    }

    const postMutation = (result: any) => {
      table?.deselectRow();
      if (result.success) {
        const event = result.results?.[0]?.event;
        if (isFunction(callback)) callback({ ...result, event, eventUpdates });
      } else if (result.error) {
        tmxToast({ intent: 'is-warning', message: result.error?.message || t('common.error') });
        if (isFunction(callback)) callback(result);
      }
    };

    if (event) {
      const eventId = event.eventId;
      const methods = [{ method: MODIFY_EVENT, params: { eventId, eventUpdates } }];
      mutationRequest({ methods, callback: postMutation });
    } else {
      const eventCategory =
        category || (ageCategoryCode && ageCategoryCode !== 'custom' ? { ageCategoryCode } : undefined);
      const eventId = tools.UUID();
      const methods = [
        {
          params: { event: { category: eventCategory, eventId, eventName, eventType, gender, startDate, endDate } },
          method: ADD_EVENT,
        },
      ];

      if (participants?.length) {
        const participantIds = participants.map(({ participantId }: any) => participantId);
        const entryStatus =
          participantType === INDIVIDUAL && [DOUBLES, TEAM].includes(eventType) ? UNGROUPED : DIRECT_ACCEPTANCE;
        const method: any = {
          params: {
            enforceCategory: true,
            enforceGender: true,
            entryStage: MAIN,
            participantIds,
            entryStatus,
            eventId,
          },
          method: ADD_EVENT_ENTRIES,
        };
        methods.push(method);
      }
      mutationRequest({ methods, callback: postMutation });
    }
  };

  const isValidForSave = () => {
    const eventName = context.drawer.attributes.content.eventName.value;
    return eventName && eventName.length >= 5;
  };

  const shouldClose = () => {
    const ageCategoryCode = context.drawer.attributes.content.ageCategoryCode.value;
    return ageCategoryCode !== 'custom' && isValidForSave();
  };

  const footer = (elem: HTMLElement, close: () => void) =>
    renderButtons(
      elem,
      [
        { label: t('common.cancel'), onClick: () => table?.deselectRow(), close: true },
        { label: t('common.save'), onClick: saveEvent, close: shouldClose, intent: 'is-info' },
      ],
      close,
    );

  const title = event?.eventId ? t('pages.events.editEvent.titleEdit') : t('pages.events.editEvent.titleAdd');
  context.drawer.open({
    title: `<b style='larger'>${title}</b>`,
    onClose: () => table?.deselectRow(),
    width: '300px',
    side: RIGHT,
    content,
    footer,
  });
}
