/**
 * Take courts and venues out of service, and return them — the confirmation and the mutation, shared by
 * the venues table popovers and the schedule grid's court header menu. The decisions (which matchUps,
 * which methods) live in `functions/courtOutOfService`; this module only shows and sends.
 */
import { confirmModal } from 'components/modals/baseModal/baseModal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';
import {
  buildCourtsOutOfServiceMethods,
  buildCourtsReturnToServiceMethods,
  buildVenuesOutOfServiceMethods,
  buildVenuesReturnToServiceMethods,
  describeMatchUpOnCourt,
  matchUpsOnCourts,
} from 'functions/courtOutOfService';

const LIST_LIMIT = 12;

type Done = (result: { success: boolean }) => void;

function send(methods: any[], engine: string | undefined, onDone?: Done): void {
  mutationRequest({
    methods,
    engine,
    callback: (result: any) => {
      const success = !!result?.success;
      if (!success && !result?.notified) tmxToast({ message: t('courtService.failed'), intent: 'is-danger' });
      onDone?.({ success });
    },
  });
}

/** The confirmation body: what goes out of service, then the unfinished matchUps that stay where they are. */
function buildConfirmContent(message: string, listed: any[]): HTMLElement {
  const content = document.createElement('div');
  content.style.cssText = 'display: flex; flex-direction: column; gap: 0.5rem;';

  const lead = document.createElement('p');
  lead.textContent = message;
  content.appendChild(lead);

  const note = document.createElement('p');
  note.style.cssText = 'color: var(--chc-text-secondary);';
  note.textContent = listed.length
    ? t('courtService.matchUpsStay', { count: listed.length })
    : t('courtService.noMatchUps');
  content.appendChild(note);

  if (listed.length) {
    const list = document.createElement('ul');
    list.style.cssText = 'margin: 0; padding-left: 1.25rem; font-size: 0.875rem; max-height: 14rem; overflow: auto;';
    for (const matchUp of listed.slice(0, LIST_LIMIT)) {
      const item = document.createElement('li');
      item.textContent = describeMatchUpOnCourt(matchUp);
      list.appendChild(item);
    }
    if (listed.length > LIST_LIMIT) {
      const more = document.createElement('li');
      more.textContent = `+${listed.length - LIST_LIMIT}`;
      list.appendChild(more);
    }
    content.appendChild(list);
  }

  return content;
}

export function confirmCourtOutOfService(params: {
  courtId: string;
  courtName: string;
  matchUps: any[];
  /** the selected schedule date; omitted takes the court out on every date */
  date?: string;
  /** the court's current out-of-service dates, carried forward by a dated change */
  existingDates?: string[];
  engine?: string;
  onDone?: Done;
}): void {
  const { courtId, courtName, matchUps, date, existingDates, engine, onDone } = params;
  const listed = matchUpsOnCourts({ matchUps, courtIds: [courtId], date });
  const message = date
    ? t('courtService.confirmCourtOnDate', { courtName, date })
    : t('courtService.confirmCourtAllDates', { courtName });
  confirmModal({
    title: t('courtService.courtTitle', { courtName }),
    query: buildConfirmContent(message, listed),
    okAction: () => send(buildCourtsOutOfServiceMethods({ courtIds: [courtId], date, existingDates }), engine, onDone),
  });
}

/** Without `date` every out-of-service date is cleared. Returning a court needs no confirmation. */
export function returnCourtToService(params: { courtId: string; date?: string; engine?: string; onDone?: Done }): void {
  const { courtId, date, engine, onDone } = params;
  send(buildCourtsReturnToServiceMethods({ courtIds: [courtId], date }), engine, onDone);
}

export function confirmVenueOutOfService(params: {
  venueId: string;
  venueName: string;
  courtIds: string[];
  matchUps: any[];
  engine?: string;
  onDone?: Done;
}): void {
  const { venueId, venueName, courtIds, matchUps, engine, onDone } = params;
  const listed = matchUpsOnCourts({ matchUps, courtIds });
  confirmModal({
    title: t('courtService.venueTitle', { venueName }),
    query: buildConfirmContent(t('courtService.confirmVenue', { venueName }), listed),
    okAction: () => send(buildVenuesOutOfServiceMethods({ venueIds: [venueId] }), engine, onDone),
  });
}

export function returnVenueToService(params: { venueId: string; engine?: string; onDone?: Done }): void {
  const { venueId, engine, onDone } = params;
  send(buildVenuesReturnToServiceMethods({ venueIds: [venueId] }), engine, onDone);
}
