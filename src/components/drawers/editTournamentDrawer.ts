/**
 * Tournament editor drawer component.
 * Allows creating new tournaments or editing existing tournament details.
 */
import { getSupportedTimeZones, isValidTimeZone } from 'functions/getSupportedTimeZones';
import { addTournament as tournamentAdd } from 'services/storage/importTournaments';
import { submitTournamentDates } from 'services/mutation/submitTournamentDates';
import { addOrUpdateTournament } from 'services/storage/addOrUpdateTournament';
import { renderButtons, renderForm, validators } from 'courthive-components';
import { mapTournamentRecord } from 'pages/tournaments/mapTournamentRecord';
import { getProvider, sendTournament } from 'services/apis/servicesApi';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { getLoginState } from 'services/authentication/loginState';
import { tmxToast } from 'services/notifications/tmxToast';
import { tournamentEngine } from 'services/factory/engine';
import { getParent } from 'services/dom/parentAndChild';
import { providerConfig } from 'config/providerConfig';
import { context } from 'services/context';
import { t, i18next } from 'i18n';

import type { AllowedTierSystem } from '@courthive/provider-config';

import { RIGHT } from 'constants/tmxConstants';
import {
  SET_TOURNAMENT_DATES,
  SET_TOURNAMENT_LOCAL_TIME_ZONE,
  SET_TOURNAMENT_NAME,
  SET_TOURNAMENT_TIER,
} from 'constants/mutationConstants';

export function editTournament({
  tournamentRecord,
  onCreated,
  table,
}: {
  table?: any;
  tournamentRecord?: any;
  onCreated?: () => void;
}): void {
  const existingTier = tournamentRecord?.tournamentTier;
  const values = {
    activeDates: (tournamentRecord?.activeDates || []).join(','),
    tournamentName: tournamentRecord?.tournamentName || '',
    startDate: tournamentRecord?.startDate || '',
    endDate: tournamentRecord?.endDate || '',
    localTimeZone: tournamentRecord?.localTimeZone || '',
    tierSystem: existingTier?.system || '',
    tierValue: existingTier?.value || '',
    tierNumericRank: existingTier?.numericRank == null ? '' : String(existingTier.numericRank),
  };
  const supportedTimeZones = getSupportedTimeZones();

  let inputs: any;
  const items = [
    {
      error: t('drawers.editTournament.nameError'),
      placeholder: t('drawers.editTournament.namePlaceholder'),
      value: values.tournamentName,
      validator: validators.nameValidator(5),
      label: t('drawers.editTournament.nameLabel'),
      field: 'tournamentName',
      focus: true,
    },
    {
      placeholder: 'YYYY-MM-DD',
      value: values.startDate,
      label: t('drawers.editTournament.startDateLabel'),
      field: 'startDate',
      language: i18next.language,
    },
    {
      placeholder: 'YYYY-MM-DD',
      value: values.endDate,
      label: t('drawers.editTournament.endDateLabel'),
      field: 'endDate',
      language: i18next.language,
    },
    {
      visible: !values.activeDates.length,
      label: t('drawers.editTournament.selectActiveDates'),
      field: 'activeDateSelector',
      id: 'activeDateSelector',
      checkbox: true,
    },
    {
      visible: !!values.activeDates.length,
      value: values.activeDates || [],
      placeholder: '[datesArray]',
      minDate: values.startDate,
      maxDate: values.endDate,
      label: t('drawers.editTournament.activeDates'),
      maxNumberOfDates: 10,
      field: 'activeDates',
      id: 'activeDates',
      date: true,
      language: i18next.language,
    },
    {
      label: t('drawers.editTournament.timeZoneLabel'),
      placeholder: t('drawers.editTournament.timeZonePlaceholder'),
      field: 'localTimeZone',
      typeAhead: {
        list: supportedTimeZones,
        currentValue: values.localTimeZone,
      },
    },
    // Tournament tier — the federation-specific competitive prestige
    // classification. When the provider config declares
    // `allowedTierSystems`, render the system as a constrained select to
    // prevent typos that silently miss the ranking policy's tierToLevel
    // map. Absent / empty → today's free-form text input. Backward-compat:
    // a pre-existing tier whose system isn't in the configured list shows
    // up as a disabled "(unknown: X)" option so we never drop one silently.
    //
    // Per-system value constraint (`values?: string[]`) is reserved for a
    // follow-up — reactively swapping the value field's options when the
    // operator changes systems mid-edit requires extra form plumbing we
    // don't yet share with the rest of the drawer.
    buildTierSystemField(values.tierSystem, t),
    {
      value: values.tierValue,
      placeholder: t('drawers.editTournament.tierValuePlaceholder'),
      label: t('drawers.editTournament.tierValueLabel'),
      field: 'tierValue',
    },
    {
      value: values.tierNumericRank,
      placeholder: t('drawers.editTournament.tierNumericRankPlaceholder'),
      label: t('drawers.editTournament.tierNumericRankLabel'),
      field: 'tierNumericRank',
    },
  ];

  const validValues = ({ tournamentName, startDate, endDate }: any) => {
    return (
      validators.nameValidator(5)(tournamentName) &&
      validators.dateValidator(startDate) &&
      validators.dateValidator(endDate)
    );
  };

  const enableSubmit = ({ inputs }: any) => {
    const activeDates = inputs['activeDates'].value;
    const startDate = inputs['startDate'].value;
    const endDate = inputs['endDate'].value;
    const valid = validValues({
      tournamentName: inputs['tournamentName'].value,
      startDate,
      endDate,
    });

    if (activeDates) {
      inputs['activeDates'].value = activeDates
        .split(',')
        .filter(
          (d: string) =>
            !((startDate && new Date(d) < new Date(startDate)) || (endDate && new Date(d) > new Date(endDate))),
        )
        .filter(Boolean)
        .join(',');
    }

    if (startDate) inputs.activeDates.datepicker.setOptions({ minDate: startDate });
    if (endDate) inputs.activeDates.datepicker.setOptions({ maxDate: endDate });

    const saveButton = document.getElementById('saveTournamentEdits');
    if (saveButton) (saveButton as HTMLButtonElement).disabled = !valid;
  };

  const toggleActiveDates = ({ inputs }: any) => {
    const show = inputs.activeDateSelector.checked;
    const activeDates = document.getElementById('activeDates');
    const fieldParent = getParent(activeDates, 'field') as any;
    if (fieldParent?.parent) fieldParent.parent.style.display = show ? 'block' : 'none';
  };

  const relationships = [
    {
      fields: ['startDate', 'endDate'],
      dateRange: true,
    },
    {
      control: 'tournamentName',
      onInput: enableSubmit,
    },
    {
      onFocusOut: enableSubmit,
      control: 'startDate',
    },
    {
      onFocusOut: enableSubmit,
      control: 'endDate',
    },
    {
      onChange: toggleActiveDates,
      control: 'activeDateSelector',
    },
  ];

  const content = (elem: HTMLElement) => {
    inputs = renderForm(elem, items, relationships);
    inputs.activeDates?.datepicker?.update();
  };

  const isValid = () => validators.nameValidator(5)(inputs.drawName.value);
  const submit = () => {
    const activeDates = inputs.activeDates.value?.split(',').filter(Boolean);
    const tournamentName = inputs.tournamentName.value?.trim();
    const startDate = inputs.startDate.value;
    const endDate = inputs.endDate.value;
    // Typeahead field exposes `value` via the same .value accessor.
    // Normalise: trim, treat empty as "clear". Silently drop invalid
    // zones (the form doesn't surface a full validation cycle yet;
    // the factory setter returns INVALID_TIME_ZONE if this slips
    // through so nothing persists).
    const rawTz = (inputs.localTimeZone?.value ?? '').trim();
    const localTimeZone = rawTz === '' || isValidTimeZone(rawTz) ? rawTz : values.localTimeZone;

    const tierSystem = (inputs.tierSystem?.value ?? '').trim();
    const tierValue = (inputs.tierValue?.value ?? '').trim();
    const tierNumericRankRaw = (inputs.tierNumericRank?.value ?? '').trim();
    const tierNumericRank = tierNumericRankRaw && !Number.isNaN(Number(tierNumericRankRaw))
      ? Number(tierNumericRankRaw)
      : undefined;

    // Build the next tier object (or null to clear). Both system and value
    // are required by the factory setter — partial input is treated as a
    // "clear" rather than an error, matching the timeZone pattern.
    const nextTier =
      tierSystem && tierValue
        ? { system: tierSystem, value: tierValue, ...(tierNumericRank === undefined ? {} : { numericRank: tierNumericRank }) }
        : null;
    const previousTier = tournamentRecord?.tournamentTier ?? null;
    const tierChanged = !tierEquals(nextTier, previousTier);

    if (tournamentRecord) {
      const updatedTournamentRecord = {
        ...tournamentRecord,
        tournamentName,
        activeDates,
        startDate,
        endDate,
        // Only overwrite the record-copy when the zone actually changed,
        // so the post-mutation table update reflects the new state.
        ...(localTimeZone === (tournamentRecord.localTimeZone ?? '')
          ? {}
          : { localTimeZone: localTimeZone || undefined }),
        ...(tierChanged ? { tournamentTier: nextTier ?? undefined } : {}),
      };
      const postMutation = (result: any) => {
        if (result.success) {
          table?.updateData([mapTournamentRecord(updatedTournamentRecord)], true);
        } else if (result?.error) {
          // e.g. matchUps scheduled outside the new tournament dates (message lists the
          // offending dates) so the user can unschedule/reschedule first.
          tmxToast({ intent: 'is-warning', message: result.error?.message ?? t('common.error') });
        }
      };
      const submit = (force?: boolean) => {
        const methods = [
          { method: SET_TOURNAMENT_DATES, params: { activeDates, startDate, endDate, ...(force ? { force: true } : {}) } },
          { method: SET_TOURNAMENT_NAME, params: { tournamentName } },
        ];
        // Only emit the TZ mutation when the value differs from what the
        // record already had — keeps the server audit log clean.
        if (localTimeZone !== (tournamentRecord.localTimeZone ?? '')) {
          methods.push({ method: SET_TOURNAMENT_LOCAL_TIME_ZONE, params: { localTimeZone } as any });
        }
        if (tierChanged) {
          methods.push({ method: SET_TOURNAMENT_TIER, params: { tournamentTier: nextTier } as any });
        }
        mutationRequest({ tournamentRecord: updatedTournamentRecord, methods, callback: postMutation });
      };

      // Pre-flight the date change locally (engine.explain, non-destructive); if
      // matchUps fall outside the new dates the user gets [Continue & unschedule]
      // (re-submits with force: true) instead of a doomed server round-trip.
      submitTournamentDates({ params: { activeDates, startDate, endDate }, submit });
    } else {
      const result = tournamentEngine.newTournamentRecord({ tournamentName, activeDates, startDate, endDate });
      if (result.success) {
        const state = getLoginState();
        const newTournamentRecord = tournamentEngine.q.tournament();
        // New tournament: apply the selected TZ immediately (local
        // mutation, pre-provider-sync).
        if (localTimeZone) {
          tournamentEngine.setTournamentLocalTimeZone({ localTimeZone });
        }
        if (nextTier) {
          tournamentEngine.setTournamentTier({ tournamentTier: nextTier });
        }
        if (state?.providerId && newTournamentRecord) {
          const addProvider = (result: any) => {
            const provider = result.data?.provider;
            newTournamentRecord.parentOrganisation = provider;
            if (provider) {
              const report = (result: any) => console.log('sendTournament', result);
              sendTournament({ tournamentRecord: newTournamentRecord }).then(() => {}, report);
            }
            completeTournamentAdd({ tournamentRecord: newTournamentRecord, table, onCreated });
          };
          getProvider({ providerId: state.providerId }).then(addProvider);
        } else {
          completeTournamentAdd({ tournamentRecord: newTournamentRecord, table, onCreated });
        }
      }
    }
  };

  const actionButton = tournamentRecord ? t('common.save') : t('add');
  const buttons = [
    { label: t('common.cancel'), intent: 'none', close: true },
    {
      disabled: !validValues(values),
      id: 'saveTournamentEdits',
      label: actionButton,
      intent: 'is-primary',
      onClick: submit,
      close: isValid,
    },
  ];

  const footer = (elem: HTMLElement, close: () => void) => renderButtons(elem, buttons, close);
  const title = tournamentRecord ? t('drawers.editTournament.titleEdit') : t('drawers.editTournament.titleNew');
  context.drawer.open({ title, content, footer, side: RIGHT, width: '300px' });
}

/**
 * Build the tierSystem field config. When the provider's
 * `allowedTierSystems` is non-empty, render as a constrained select with
 * a leading blank option ("no system") plus a fallback disabled option
 * for any pre-existing tier whose system isn't in the configured list —
 * the operator can pick a configured system to migrate or leave the
 * fallback untouched, but we never silently strip an unknown system.
 *
 * When `allowedTierSystems` is empty / absent, fall back to today's
 * free-form text input.
 */
function buildTierSystemField(currentSystem: string, tFn: typeof t): any {
  const allowed = providerConfig.getAllowedList('allowedTierSystems') as AllowedTierSystem[];
  if (!allowed.length) {
    return {
      value: currentSystem,
      placeholder: tFn('drawers.editTournament.tierSystemPlaceholder'),
      label: tFn('drawers.editTournament.tierSystemLabel'),
      field: 'tierSystem',
    };
  }

  const knownSystems = new Set(allowed.map((entry) => entry.system));
  const isUnknown = !!currentSystem && !knownSystems.has(currentSystem);
  const options: any[] = [
    { value: '', label: tFn('drawers.editTournament.tierSystemNone'), selected: !currentSystem },
    ...allowed.map((entry) => ({
      value: entry.system,
      label: entry.displayName ?? entry.system,
      selected: entry.system === currentSystem,
    })),
  ];
  if (isUnknown) {
    options.push({
      value: currentSystem,
      label: tFn('drawers.editTournament.tierSystemUnknown', { system: currentSystem }),
      selected: true,
      disabled: true,
    });
  }
  return {
    value: currentSystem,
    label: tFn('drawers.editTournament.tierSystemLabel'),
    field: 'tierSystem',
    options,
  };
}

// Structural equality for tournamentTier so we don't emit a setter mutation
// when the operator opens/closes the drawer without changing anything.
// Stable field order (system, value, numericRank) lets us avoid JSON.stringify
// quirks across runtimes.
function tierEquals(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  return a.system === b.system && a.value === b.value && (a.numericRank ?? null) === (b.numericRank ?? null);
}

function completeTournamentAdd({
  tournamentRecord,
  table,
  onCreated,
}: {
  tournamentRecord: any;
  table?: any;
  onCreated?: () => void;
}): void {
  if (table) {
    const refresh = () => table.addData([mapTournamentRecord(tournamentRecord)], true);
    tournamentAdd({ tournamentRecord, callback: refresh });
  } else {
    addOrUpdateTournament({ tournamentRecord, callback: onCreated });
  }
}
