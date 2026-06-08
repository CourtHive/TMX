/**
 * Event editor drawer for creating and modifying events.
 * Handles event configuration including name, type, gender, category, and dates.
 */
import { getCategoryModal, renderButtons, renderForm, validators } from 'courthive-components';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { providerConfig } from 'config/providerConfig';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';
import { t } from 'i18n';
import { tournamentEngine } from 'services/factory/engine';
import { drawDefinitionConstants, entryStatusConstants, participantConstants, genderConstants, eventConstants, fixtures, tools } from 'tods-competition-factory';

import { ADD_EVENT, ADD_EVENT_ENTRIES, MODIFY_EVENT, SET_TOURNAMENT_CATEGORIES } from 'constants/mutationConstants';
import { RIGHT } from 'constants/tmxConstants';

const { ALTERNATE, DIRECT_ACCEPTANCE, UNGROUPED, STRUCTURE_SELECTED_STATUSES } = entryStatusConstants;
const { ANY, FEMALE, MALE, MIXED } = genderConstants;
const { DOUBLES, SINGLES, TEAM } = eventConstants;

// Some tournaments have a stray "------------" ageCategoryCode persisted
// from an old form-rendering bug (renderField treated value: '' as falsy
// and the select fell back to the dashed label as its value). Strip them
// at read time so we don't keep rendering the placeholder in dropdowns
// and event detail. Root-cause fix landed in courthive-components.
function cleanAgeCode(value: any): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^[-—–_]+$/.test(trimmed)) return undefined;
  return trimmed;
}
const { INDIVIDUAL, PAIR } = participantConstants;
const { MAIN } = drawDefinitionConstants;
const { competitionFormats } = fixtures;

// Keys mirror the fixture names shipped from tods-competition-factory.
// Add new entries here when a new preset ships; the dropdown is data-driven.
const COMPETITION_FORMAT_KEYS = ['TENNIS_STANDARD', 'INTENNSE_STANDARD'] as const;
type CompetitionFormatKey = (typeof COMPETITION_FORMAT_KEYS)[number] | '';

// Auto-suggest based on the event's existing matchUpFormat. The INTENNSE
// scoring code uses an `XA` segment marker (e.g. SET7XA-S:T10P) that no other
// shipped preset emits — when we see it on an event without a competitionFormat
// already attached, default the dropdown to INTENNSE_STANDARD so the operator
// only has to confirm.
function suggestCompetitionFormatKey(event: any): CompetitionFormatKey {
  const existingName = event?.competitionFormat?.competitionFormatName as CompetitionFormatKey | undefined;
  if (existingName && COMPETITION_FORMAT_KEYS.includes(existingName as any)) return existingName;
  const matchUpFormat = event?.matchUpFormat;
  if (typeof matchUpFormat === 'string' && matchUpFormat.includes('XA')) return 'INTENNSE_STANDARD';
  return '';
}

const DEFAULT_AGE_CATEGORIES = [
  { code: 'U10', label: '10 and Under' },
  { code: 'U12', label: '12 and Under' },
  { code: 'U14', label: '14 and Under' },
  { code: 'U16', label: '16 and Under' },
  { code: 'U18', label: '18 and Under' },
];

function resolveEnteredGenderOptions(event: any, enteredParticipantGenders: any[]): string[] {
  const options = [ANY];
  if (event.gender && event.gender !== ANY) options.push(event.gender);
  if (event.eventType === DOUBLES && !options.includes(MIXED)) options.push(MIXED);
  const uniqueEnteredGenders = tools.unique(enteredParticipantGenders.flat());
  if (uniqueEnteredGenders.length === 1 && !options.includes(uniqueEnteredGenders[0])) {
    options.push(...uniqueEnteredGenders);
  }
  return options;
}

function buildCategoryOptionsList(
  tournamentCategories: any[],
  isCategoryAllowed: (code: string) => boolean,
  selectedCode: string | undefined,
): any[] {
  const options: any[] = [
    {
      selected: ['', undefined].includes(selectedCode),
      label: '------------',
      value: '',
    },
  ];

  if (tournamentCategories.length > 0) {
    tournamentCategories
      .filter((cat: any) => isCategoryAllowed(cleanAgeCode(cat.ageCategoryCode) || cat.categoryName))
      .forEach((cat: any) => {
        const cleanCode = cleanAgeCode(cat.ageCategoryCode);
        const label = cleanCode ? `${cat.categoryName} (${cleanCode})` : cat.categoryName;
        const value = cleanCode || cat.categoryName;
        options.push({
          selected: selectedCode === value,
          label,
          value,
        });
      });
  } else {
    DEFAULT_AGE_CATEGORIES
      .filter(({ code }) => isCategoryAllowed(code))
      .forEach(({ code, label }) => {
        options.push({
          selected: selectedCode === code,
          label,
          value: code,
        });
      });
  }

  options.push({
    selected: false,
    label: t('pages.events.editEvent.custom'),
    value: 'custom',
  });

  return options;
}

export function editEvent({
  table,
  event,
  participants,
  callback,
}: { table?: any; event?: any; participants?: any[]; callback?: (result: any) => void } = {}): void {
  const eventsCount = tournamentEngine.q.events()?.length || 0;
  const tournamentInfo = tournamentEngine.q.tournamentInfo() || {};
  const values: any = {
    eventName: event?.eventName || `Event ${eventsCount + 1}`,
    startDate: event?.startDate ?? tournamentInfo.startDate,
    endDate: event?.endDate ?? tournamentInfo.endDate,
    ageCategoryCode: event?.category?.ageCategoryCode,
    eventType: event?.eventType || SINGLES,
    gender: event?.gender || ANY,
    competitionFormatKey: suggestCompetitionFormatKey(event),
  };

  const enteredParticipantIds = event?.entries
    ?.filter(({ entryStatus }: any) => [...STRUCTURE_SELECTED_STATUSES, ALTERNATE].includes(entryStatus))
    .map(({ participantId }: any) => participantId);

  const enteredParticipants = enteredParticipantIds
    ? (tournamentEngine.getParticipants({
        participantFilters: { participantIds: enteredParticipantIds },
        withIndividualParticipants: true,
      }).participants ?? [])
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
      participantType === INDIVIDUAL ? tools.unique(participants.map((p: any) => p.participant?.person?.sex)) : [];

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
  const categories = tools.unique(participantAgeCategories.flat());
  if (categories.length === 1) values.ageCategoryCode = categories[0];

  if (enteredParticipantGenders.length) {
    genderOptions = resolveEnteredGenderOptions(event, enteredParticipantGenders);
  } else if (event) {
    genderOptions = [ANY, MALE, MIXED, FEMALE];
  }

  // Get tournament categories for dropdown
  const tournamentRecord = tournamentEngine.q.tournament();
  const tournamentCategories = tournamentRecord?.tournamentCategories || [];

  // Build category options from tournament categories
  const allowedCategories = providerConfig.getAllowedList('allowedCategories');
  const isCategoryAllowed = (code: string) =>
    !allowedCategories.length || allowedCategories.some((c: any) => c.ageCategoryCode === code);

  const buildCategoryOptions = () =>
    buildCategoryOptionsList(
      tournamentCategories,
      isCategoryAllowed,
      values.ageCategoryCode,
    );

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
          value: values.competitionFormatKey,
          field: 'competitionFormatKey',
          label: t('pages.events.editEvent.competitionFormatLabel'),
          options: [
            {
              selected: !values.competitionFormatKey,
              label: t('pages.events.editEvent.competitionFormatNone'),
              value: '',
            },
            {
              selected: values.competitionFormatKey === 'TENNIS_STANDARD',
              label: t('pages.events.editEvent.competitionFormatTennis'),
              value: 'TENNIS_STANDARD',
            },
            {
              selected: values.competitionFormatKey === 'INTENNSE_STANDARD',
              label: t('pages.events.editEvent.competitionFormatIntennse'),
              value: 'INTENNSE_STANDARD',
            },
          ],
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
        if (!categoryResult?.ageCategoryCode) return;

        const finalize = () => {
          context.drawer.attributes.content.ageCategoryCode.value = categoryResult.ageCategoryCode;
          proceedWithSave(categoryResult);
        };

        const existing = tournamentRecord?.tournamentCategories || [];
        const isDuplicate = existing.some(
          (cat: any) =>
            cat.ageCategoryCode === categoryResult.ageCategoryCode ||
            cat.categoryName === categoryResult.categoryName,
        );

        if (isDuplicate) {
          finalize();
          return;
        }

        // Persist the new tournament category via mutationRequest so the
        // server learns about it before we proceed with the event save.
        const updatedCategories = [...existing, categoryResult];
        mutationRequest({
          methods: [{ method: SET_TOURNAMENT_CATEGORIES, params: { categories: updatedCategories } }],
          callback: (resp: any) => {
            if (!resp?.success) {
              tmxToast({
                message: t('pages.events.editEvent.categorySaveWarning'),
                intent: 'is-warning',
              });
              return;
            }
            // Add the new option to the dropdown so the user sees their
            // category selected immediately.
            if (formInputs?.ageCategoryCode) {
              const cleanCode = cleanAgeCode(categoryResult.ageCategoryCode);
              const label = cleanCode
                ? `${categoryResult.categoryName} (${cleanCode})`
                : categoryResult.categoryName;
              const value = cleanCode || categoryResult.categoryName;
              const customIndex = formInputs.ageCategoryCode.options.length - 1;
              const newOption = new Option(label, value);
              formInputs.ageCategoryCode.options.add(newOption, customIndex);
              formInputs.ageCategoryCode.value = value;
            }
            finalize();
          },
        });
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

    // Only forward competitionFormat when the user actually changed it.
    // Sending the same value unnecessarily would still work, but the diff
    // log gets noisy and the server has to round-trip a deep copy on
    // every event save.
    const formCompetitionFormatKey = (
      context.drawer.attributes.content.competitionFormatKey?.value || ''
    ) as CompetitionFormatKey;
    const existingCompetitionFormatKey = (event?.competitionFormat?.competitionFormatName ?? '') as CompetitionFormatKey;
    if (formCompetitionFormatKey !== existingCompetitionFormatKey) {
      eventUpdates.competitionFormat = formCompetitionFormatKey
        ? (competitionFormats as any)[formCompetitionFormatKey]
        : null;
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
      const newEventPayload: any = {
        category: eventCategory,
        eventId,
        eventName,
        eventType,
        gender,
        startDate,
        endDate,
      };
      if (formCompetitionFormatKey) {
        newEventPayload.competitionFormat = (competitionFormats as any)[formCompetitionFormatKey];
      }
      const methods = [
        {
          params: { event: newEventPayload },
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
