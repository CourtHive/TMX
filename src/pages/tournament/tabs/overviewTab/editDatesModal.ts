import { openModal, closeModal } from 'components/modals/baseModal/baseModal';
import { getSupportedTimeZones, isValidTimeZone } from 'functions/getSupportedTimeZones';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderForm, validators } from 'courthive-components';
import { tournamentEngine } from 'services/factory/engine';
import { getDetectedTimeZone } from 'functions/getDetectedTimeZone';
import { getParent } from 'services/dom/parentAndChild';
import { t, i18next } from 'i18n';

// constants
import { SET_TOURNAMENT_DATES, SET_TOURNAMENT_LOCAL_TIME_ZONE } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

export function openEditDatesModal({ onSave }: { onSave: () => void }): void {
  const { tournamentInfo } = tournamentEngine.getTournamentInfo();
  const startDate = tournamentInfo?.startDate || '';
  const endDate = tournamentInfo?.endDate || '';
  const existingActiveDates = (tournamentInfo?.activeDates || []).join(',');
  const existingTimeZone = tournamentEngine.q.tournament()?.localTimeZone || '';
  // Pre-fill the picker with the browser-detected zone when nothing is set,
  // so the TD can simply hit Save to confirm. The hint span (appended after
  // the form renders) makes it explicit that the value is a suggestion,
  // not an existing setting.
  const detectedTimeZone = existingTimeZone ? '' : getDetectedTimeZone() ?? '';
  const supportedTimeZones = getSupportedTimeZones();

  let inputs: any;
  let modalHandle: any;

  const enableSubmit = ({ inputs }: any) => {
    const newStartDate = inputs['startDate'].value;
    const newEndDate = inputs['endDate'].value;
    const valid = validators.dateValidator(newStartDate) && validators.dateValidator(newEndDate);

    // Filter activeDates to stay within the date range
    const activeDates = inputs['activeDates'].value;
    if (activeDates) {
      inputs['activeDates'].value = activeDates
        .split(',')
        .filter(
          (d: string) =>
            !((newStartDate && new Date(d) < new Date(newStartDate)) ||
              (newEndDate && new Date(d) > new Date(newEndDate))),
        )
        .filter(Boolean)
        .join(',');
    }

    if (newStartDate) inputs.activeDates.datepicker?.setOptions({ minDate: newStartDate });
    if (newEndDate) inputs.activeDates.datepicker?.setOptions({ maxDate: newEndDate });

    modalHandle?.setButtonState('saveDatesEdits', { disabled: !valid });
  };

  const toggleActiveDates = ({ inputs }: any) => {
    const show = inputs.activeDateSelector.checked;
    const fieldParent = getParent(inputs.activeDates, 'field') as any;
    if (fieldParent?.parent) fieldParent.parent.style.display = show ? 'block' : 'none';
  };

  const items = [
    {
      placeholder: 'YYYY-MM-DD',
      value: startDate,
      label: t('modals.editDates.startDateLabel'),
      field: 'startDate',
      language: i18next.language,
    },
    {
      placeholder: 'YYYY-MM-DD',
      value: endDate,
      label: t('modals.editDates.endDateLabel'),
      field: 'endDate',
      language: i18next.language,
    },
    {
      visible: !existingActiveDates.length,
      label: t('drawers.editTournament.selectActiveDates'),
      field: 'activeDateSelector',
      id: 'modalActiveDateSelector',
      checkbox: true,
    },
    {
      visible: !!existingActiveDates.length,
      value: existingActiveDates || [],
      placeholder: '[datesArray]',
      minDate: startDate,
      maxDate: endDate,
      label: t('drawers.editTournament.activeDates'),
      maxNumberOfDates: 10,
      field: 'activeDates',
      id: 'modalActiveDates',
      date: true,
      language: i18next.language,
    },
    // Time zone picker — IANA zone backing every "Live"/"Completed"
    // boundary, scheduled-time render, and audit timestamp on the
    // tournament. Same typeAhead pattern used in the New Tournament
    // drawer. Empty value === "clear" so TDs can unset back to the
    // host-local fallback.
    {
      label: t('drawers.editTournament.timeZoneLabel'),
      placeholder: t('drawers.editTournament.timeZonePlaceholder'),
      field: 'localTimeZone',
      typeAhead: {
        list: supportedTimeZones,
        currentValue: existingTimeZone || detectedTimeZone,
      },
    },
  ];

  const relationships = [
    { fields: ['startDate', 'endDate'], dateRange: true },
    { control: 'startDate', onFocusOut: enableSubmit },
    { control: 'endDate', onFocusOut: enableSubmit },
    { control: 'activeDateSelector', onChange: toggleActiveDates },
  ];

  const content = (elem: HTMLElement) => {
    inputs = renderForm(elem, items, relationships);
    inputs.activeDates?.datepicker?.update();
    // When the TZ field was pre-filled from browser detection (not from a
    // saved value), surface a small hint right below the field so the TD
    // knows the value is a suggestion they can accept or override. Without
    // this they could mistake the pre-fill for an existing setting and
    // unknowingly commit it on save.
    if (detectedTimeZone && !existingTimeZone) {
      const fieldParent = getParent(inputs.localTimeZone, 'field') as any;
      const fieldEl: HTMLElement | undefined = fieldParent?.parent;
      if (fieldEl) {
        const hint = document.createElement('div');
        hint.style.cssText =
          'font-size: 0.8rem; color: var(--tmx-text-secondary, #888); margin-top: 2px; font-style: italic;';
        hint.textContent = t('modals.editDates.timeZoneDetectedHint', { zone: detectedTimeZone });
        fieldEl.appendChild(hint);
      }
    }
  };

  const onClick = () => {
    const newStartDate = inputs['startDate'].value;
    const newEndDate = inputs['endDate'].value;
    const activeDates = inputs['activeDates'].value?.split(',').filter(Boolean);
    // Trim + validate the timezone. Empty string === clear; invalid input
    // (e.g. partial typeahead match) falls back to the existing value so
    // the user doesn't accidentally clobber a good zone with garbage.
    const rawTz = (inputs.localTimeZone?.value ?? '').trim();
    const localTimeZone = rawTz === '' || isValidTimeZone(rawTz) ? rawTz : existingTimeZone;

    const methods: { method: string; params: any }[] = [
      { method: SET_TOURNAMENT_DATES, params: { startDate: newStartDate, endDate: newEndDate, activeDates } },
    ];
    // Only emit the TZ mutation when the value actually changed — keeps
    // the server audit trail clean and matches the drawer's behavior.
    if (localTimeZone !== existingTimeZone) {
      methods.push({ method: SET_TOURNAMENT_LOCAL_TIME_ZONE, params: { localTimeZone } });
    }

    const postMutation = (result: any) => {
      if (result?.success) {
        closeModal();
        onSave();
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };

  const valid = validators.dateValidator(startDate) && validators.dateValidator(endDate);

  modalHandle = openModal({
    title: t('modals.editDates.title'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: NONE, close: true },
      { label: t('common.save'), id: 'saveDatesEdits', disabled: !valid, intent: 'is-primary', onClick },
    ],
  });
}
