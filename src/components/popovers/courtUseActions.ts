/**
 * Stop using courts and venues, and use them again — the confirmation and the mutation, shared by
 * the venues table popovers and the schedule grid's court header menu. The decisions (which matchUps,
 * which methods) live in `functions/courtUse`; this module only shows and sends.
 */
import { confirmModal } from 'components/modals/baseModal/baseModal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';
import {
  buildCourtsDisabledMethods,
  buildCourtsEnableMethods,
  buildVenuesDisabledMethods,
  buildVenuesEnableMethods,
  describeMatchUpOnCourt,
  matchUpsOnCourts,
} from 'functions/courtUse';

const LIST_LIMIT = 12;

type Done = (result: { success: boolean }) => void;

function send(methods: any[], engine: string | undefined, onDone?: Done): void {
  mutationRequest({
    methods,
    engine,
    callback: (result: any) => {
      const success = !!result?.success;
      if (!success && !result?.notified) tmxToast({ message: t('courtUse.failed'), intent: 'is-danger' });
      onDone?.({ success });
    },
  });
}

/** The confirmation body: what stops being used, then the unfinished matchUps that stay where they are. */
function buildConfirmContent(message: string, listed: any[]): HTMLElement {
  const content = document.createElement('div');
  content.style.cssText = 'display: flex; flex-direction: column; gap: 0.5rem;';

  const lead = document.createElement('p');
  lead.textContent = message;
  content.appendChild(lead);

  const note = document.createElement('p');
  note.style.cssText = 'color: var(--chc-text-secondary);';
  note.textContent = listed.length ? t('courtUse.matchUpsStay', { count: listed.length }) : t('courtUse.noMatchUps');
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

export function confirmCourtDisabled(params: {
  courtId: string;
  courtName: string;
  matchUps: any[];
  /** the selected schedule date; omitted takes the court out on every date */
  date?: string;
  /** the court's current disabled dates, carried forward by a dated change */
  existingDates?: string[];
  engine?: string;
  onDone?: Done;
}): void {
  const { courtId, courtName, matchUps, date, existingDates, engine, onDone } = params;
  const listed = matchUpsOnCourts({ matchUps, courtIds: [courtId], date });
  const message = date
    ? t('courtUse.confirmCourtOnDate', { courtName, date })
    : t('courtUse.confirmCourtAllDates', { courtName });
  confirmModal({
    title: t('courtUse.courtTitle', { courtName }),
    query: buildConfirmContent(message, listed),
    okAction: () => send(buildCourtsDisabledMethods({ courtIds: [courtId], date, existingDates }), engine, onDone),
  });
}

/** Without `date` every disabled date is cleared. Returning a court needs no confirmation. */
export function enableCourt(params: { courtId: string; date?: string; engine?: string; onDone?: Done }): void {
  const { courtId, date, engine, onDone } = params;
  send(buildCourtsEnableMethods({ courtIds: [courtId], date }), engine, onDone);
}

export function confirmVenueDisabled(params: {
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
    title: t('courtUse.venueTitle', { venueName }),
    query: buildConfirmContent(t('courtUse.confirmVenue', { venueName }), listed),
    okAction: () => send(buildVenuesDisabledMethods({ venueIds: [venueId] }), engine, onDone),
  });
}

export function enableVenue(params: { venueId: string; engine?: string; onDone?: Done }): void {
  const { venueId, engine, onDone } = params;
  send(buildVenuesEnableMethods({ venueIds: [venueId] }), engine, onDone);
}
