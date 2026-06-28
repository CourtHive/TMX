/**
 * Manage Practice Registrations modal.
 *
 * Lists current registrations on a specific PRACTICE booking and lets the
 * TD add or remove participant registrations against sub-windows inside
 * the booking. All writes go through `mutationRequest`. Participant
 * double-booking conflicts surface as a warning toast — the factory
 * mutation never rejects on them (per the Phase 1 warn-and-allow posture).
 */

import { mutationRequest } from 'services/mutation/mutationRequest';
import { openModal, closeModal } from './baseModal/baseModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { renderForm } from 'courthive-components';
import { t } from 'i18n';
import {
  resolveBookingForModal,
  formatBookingHeader,
  formatRegistrationLabel,
  filterParticipantsForRegistration,
  type BookingResolution,
} from './managePracticeRegistrationsModal.logic';

import { ADD_PRACTICE_REGISTRATION, REMOVE_PRACTICE_REGISTRATION } from 'constants/mutationConstants';

const WARNING_INTENT = 'is-warning';

type OpenArgs = {
  courtId: string;
  date: string;
  bookingId: string;
};


export function openManagePracticeRegistrationsModal({ courtId, date, bookingId }: OpenArgs): void {
  const refresh = () => rebuild();

  let body: HTMLElement | null = null;

  const rebuild = () => {
    if (!body) return;
    body.innerHTML = '';
    body.appendChild(renderBody({ courtId, date, bookingId, refresh }));
  };

  const content = (elem: HTMLElement) => {
    body = elem;
    rebuild();
  };

  openModal({
    title: t('modals.practiceRegistrations.title'),
    content,
    buttons: [{ label: t('common.close'), close: true }],
  });
}

function renderBody({
  courtId,
  date,
  bookingId,
  refresh,
}: OpenArgs & { refresh: () => void }): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 16px; min-width: 420px;';

  const resolution = resolveBookingForModal({ courtId, date, bookingId });
  if (!resolution) {
    const empty = document.createElement('div');
    empty.textContent = t('modals.practiceRegistrations.bookingNotFound');
    container.appendChild(empty);
    return container;
  }

  container.appendChild(buildHeader(resolution));
  container.appendChild(buildRegistrationsList({ resolution, courtId, date, bookingId, refresh }));
  container.appendChild(buildAddForm({ resolution, courtId, date, bookingId, refresh }));

  return container;
}

function buildHeader(resolution: BookingResolution): HTMLElement {
  const header = document.createElement('div');
  header.style.cssText = 'font-size: 13px; color: var(--sp-muted, #888);';
  header.textContent = formatBookingHeader(resolution);
  return header;
}

function buildRegistrationsList({
  resolution,
  courtId,
  date,
  bookingId,
  refresh,
}: {
  resolution: BookingResolution;
  courtId: string;
  date: string;
  bookingId: string;
  refresh: () => void;
}): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';

  const heading = document.createElement('div');
  heading.style.cssText = 'font-weight: 600; font-size: 13px;';
  heading.textContent = t('modals.practiceRegistrations.currentRegistrations');
  wrap.appendChild(heading);

  const registrations = resolution.booking.registrations ?? [];
  const active = registrations.filter((r: any) => r.status !== 'CANCELLED');

  if (!active.length) {
    const emptyEl = document.createElement('div');
    emptyEl.style.cssText = 'font-size: 12px; color: var(--sp-muted, #888); font-style: italic;';
    emptyEl.textContent = t('modals.practiceRegistrations.noneYet');
    wrap.appendChild(emptyEl);
    return wrap;
  }

  for (const registration of active) {
    wrap.appendChild(
      buildRegistrationRow({
        registration,
        nameById: resolution.nameById,
        courtId,
        date,
        bookingId,
        refresh,
      }),
    );
  }

  return wrap;
}

function buildRegistrationRow({
  registration,
  nameById,
  courtId,
  date,
  bookingId,
  refresh,
}: {
  registration: any;
  nameById: Map<string, string>;
  courtId: string;
  date: string;
  bookingId: string;
  refresh: () => void;
}): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText =
    'display: flex; align-items: center; gap: 12px; padding: 6px 8px; background: var(--sp-card-bg, #fafafa); border-radius: 4px;';

  const label = document.createElement('div');
  label.style.cssText = 'flex: 1; font-size: 13px;';
  label.textContent = formatRegistrationLabel(registration, nameById);
  row.appendChild(label);

  const removeBtn = document.createElement('button');
  removeBtn.className = 'button is-small is-danger is-light';
  removeBtn.textContent = t('common.remove');
  removeBtn.addEventListener('click', () => {
    mutationRequest({
      methods: [
        {
          method: REMOVE_PRACTICE_REGISTRATION,
          params: { courtId, date, bookingId, registrationId: registration.registrationId },
        },
      ],
      callback: (result: any) => {
        if (result?.success) {
          tmxToast({ message: t('modals.practiceRegistrations.removed'), intent: 'is-success' });
          refresh();
        }
      },
    });
  });
  row.appendChild(removeBtn);

  return row;
}

function buildAddForm({
  resolution,
  courtId,
  date,
  bookingId,
  refresh,
}: {
  resolution: BookingResolution;
  courtId: string;
  date: string;
  bookingId: string;
  refresh: () => void;
}): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display: flex; flex-direction: column; gap: 8px; border-top: 1px solid var(--sp-line, #ddd); padding-top: 12px;';

  const heading = document.createElement('div');
  heading.style.cssText = 'font-weight: 600; font-size: 13px;';
  heading.textContent = t('modals.practiceRegistrations.addRegistrant');
  wrap.appendChild(heading);

  const values: { participantId: string; startTime: string; endTime: string } = {
    participantId: '',
    startTime: resolution.booking.startTime ?? '',
    endTime: resolution.booking.endTime ?? '',
  };

  const typeAheadList = filterParticipantsForRegistration(resolution).map((p) => ({
    label: p.participantName,
    value: p.participantId,
  }));

  const formMount = document.createElement('div');
  renderForm(formMount, [
    {
      typeAhead: {
        list: typeAheadList,
        callback: (participantId: string) => {
          values.participantId = participantId;
        },
      },
      placeholder: t('modals.practiceRegistrations.participantPlaceholder'),
      label: t('modals.practiceRegistrations.participantLabel'),
      field: 'participant',
      width: '100%',
    },
  ]);
  wrap.appendChild(formMount);

  wrap.appendChild(buildTimeWindowInputs(values, resolution));

  const addBtn = document.createElement('button');
  addBtn.className = 'button is-primary is-small';
  addBtn.style.alignSelf = 'flex-start';
  addBtn.textContent = t('modals.practiceRegistrations.add');
  addBtn.addEventListener('click', () => submitAdd({ courtId, date, bookingId, values, refresh }));
  wrap.appendChild(addBtn);

  return wrap;
}

function buildTimeWindowInputs(
  values: { startTime: string; endTime: string },
  resolution: BookingResolution,
): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = 'display: flex; gap: 12px;';

  row.appendChild(
    buildTimeField({
      label: t('modals.practiceRegistrations.startTime'),
      initial: values.startTime,
      min: resolution.booking.startTime ?? undefined,
      max: resolution.booking.endTime ?? undefined,
      onChange: (next) => (values.startTime = next),
    }),
  );
  row.appendChild(
    buildTimeField({
      label: t('modals.practiceRegistrations.endTime'),
      initial: values.endTime,
      min: resolution.booking.startTime ?? undefined,
      max: resolution.booking.endTime ?? undefined,
      onChange: (next) => (values.endTime = next),
    }),
  );

  return row;
}

function buildTimeField({
  label,
  initial,
  min,
  max,
  onChange,
}: {
  label: string;
  initial: string;
  min?: string;
  max?: string;
  onChange: (next: string) => void;
}): HTMLElement {
  const field = document.createElement('div');
  field.style.cssText = 'display: flex; flex-direction: column; gap: 4px; flex: 1;';

  const lbl = document.createElement('label');
  lbl.style.cssText = 'font-size: 12px; color: var(--sp-muted, #888);';
  lbl.textContent = label;
  field.appendChild(lbl);

  const input = document.createElement('input');
  input.type = 'time';
  input.className = 'input is-small';
  input.value = initial;
  if (min) input.min = min;
  if (max) input.max = max;
  input.addEventListener('change', () => onChange(input.value));
  field.appendChild(input);

  return field;
}

function submitAdd({
  courtId,
  date,
  bookingId,
  values,
  refresh,
}: {
  courtId: string;
  date: string;
  bookingId: string;
  values: { participantId: string; startTime: string; endTime: string };
  refresh: () => void;
}): void {
  if (!values.participantId) {
    tmxToast({ message: t('modals.practiceRegistrations.pickParticipant'), intent: WARNING_INTENT });
    return;
  }
  if (!values.startTime || !values.endTime) {
    tmxToast({ message: t('modals.practiceRegistrations.pickTimes'), intent: WARNING_INTENT });
    return;
  }
  if (values.startTime >= values.endTime) {
    tmxToast({ message: t('modals.practiceRegistrations.invalidWindow'), intent: WARNING_INTENT });
    return;
  }

  mutationRequest({
    methods: [
      {
        method: ADD_PRACTICE_REGISTRATION,
        params: {
          courtId,
          date,
          bookingId,
          participantId: values.participantId,
          startTime: values.startTime,
          endTime: values.endTime,
        },
      },
    ],
    callback: (result: any) => {
      if (!result?.success) return;
      const conflicts = result?.results?.[0]?.conflicts;
      if (conflicts?.matchUps?.length || conflicts?.practiceRegistrations?.length) {
        tmxToast({
          message: t('modals.practiceRegistrations.conflictWarning'),
          intent: WARNING_INTENT,
          duration: 5000,
        });
      } else {
        tmxToast({ message: t('modals.practiceRegistrations.added'), intent: 'is-success' });
      }
      refresh();
    },
  });
}

// Re-export the close helper for tests / callers that programmatically close.
export { closeModal as closeManagePracticeRegistrationsModal };
