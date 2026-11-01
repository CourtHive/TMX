/**
 * The schedule grid's side of courts out of service: grey a court's column (header and cells) when it
 * is out of service on the grid's date, offer Take out of / Return to service in the court header menu,
 * and refuse any placement onto such a court.
 *
 * The column is greyed, never hidden — the director still sees the matchUps already on it, which stay
 * where they are. The decisions live in `functions/courtOutOfService`.
 */
import { courtServiceState, outOfServiceCourtIds, refusedPlacementCourtIds } from 'functions/courtOutOfService';
import { competitionEngine } from 'services/factory/engine';
import { scheduleToast } from './scheduleToast';
import { t } from 'i18n';
import {
  confirmCourtOutOfService,
  returnCourtToService,
  returnVenueToService,
} from 'components/popovers/courtServiceActions';

// constants
import { COMPETITION_ENGINE } from 'constants/tmxConstants';

export const OUT_OF_SERVICE_CLASS = 'tmx-court-out-of-service';
const OUT_OF_SERVICE_HEADER_CLASS = 'tmx-court-out-of-service-header';
const STYLE_ID = 'tmx-court-service-styles';

/** Theme variables only, so the greying reads in light and dark mode alike. */
function ensureCourtServiceStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent =
    `.${OUT_OF_SERVICE_CLASS}{background-color:var(--sp-panel-bg);` +
    'background-image:repeating-linear-gradient(135deg,var(--sp-chip-bg) 0 6px,transparent 6px 12px);' +
    'cursor:not-allowed !important;}' +
    `.${OUT_OF_SERVICE_CLASS} > *{opacity:0.5;filter:grayscale(1);}` +
    `.${OUT_OF_SERVICE_HEADER_CLASS}{color:var(--sp-muted) !important;` +
    'background-image:repeating-linear-gradient(135deg,var(--sp-chip-bg) 0 6px,transparent 6px 12px);}';
  document.head.appendChild(style);
}

function venuesAndCourts(): { courts: any[]; venues: any[] } {
  const { courts = [], venues = [] }: any = competitionEngine.getVenuesAndCourts();
  return { courts, venues };
}

/** The courts out of service on `date`, read from the engine (the grid's own court data may be a plan view). */
export function gridOutOfServiceCourtIds(date: string): Set<string> {
  ensureCourtServiceStyles();
  return outOfServiceCourtIds({ ...venuesAndCourts(), date });
}

export function decorateOutOfServiceHeader(th: HTMLElement, courtName: string): void {
  th.classList.add(OUT_OF_SERVICE_HEADER_CLASS);
  th.title = `${courtName} — ${t('courtService.outOfService')}`;
}

/** Greys the cell and shows the not-allowed cursor while something is dragged over it. */
export function decorateOutOfServiceCell(cell: HTMLElement): void {
  cell.classList.add(OUT_OF_SERVICE_CLASS);
  cell.title = t('courtService.outOfService');
  cell.addEventListener('dragover', (e) => {
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
  });
}

/**
 * True (and the director is told why) when `methods` would place a matchUp on a court that is out of
 * service on its date. Every grid placement — drop, type-ahead, Now strip — passes through here.
 */
export function refuseOutOfServicePlacement(methods: any[], date: string): boolean {
  const { courts, venues } = venuesAndCourts();
  const refused = refusedPlacementCourtIds({ methods, courts, venues, date });
  if (!refused.length) return false;
  const court = courts.find((c: any) => c.courtId === refused[0]);
  const courtName = court?.courtName || refused[0];
  scheduleToast({ message: t('courtService.dropRefused', { courtName }), intent: 'is-warning' });
  return true;
}

/** Refuse a drop onto one court before any confirmation is shown for it. */
export function refuseOutOfServiceCourt(courtId: string, date: string): boolean {
  return refuseOutOfServicePlacement([{ params: { schedule: { courtId, scheduledDate: date } } }], date);
}

/**
 * The court header menu's service options for `date`: out of service on that date or on every date,
 * and the matching returns. A court whose venue is out of service offers only the venue's return.
 */
export function courtServiceMenuOptions(params: {
  courtId: string;
  courtName: string;
  date: string;
  matchUps: any[];
  onDone: () => void;
}): { option: string; onClick: () => void }[] {
  const { courtId, courtName, date, matchUps, onDone } = params;
  const { courts, venues } = venuesAndCourts();
  const court = courts.find((c: any) => c.courtId === courtId);
  if (!court) return [];
  const venue = venues.find((v: any) => v.venueId === court.venueId);
  const { allDates, dates, venueOutOfService } = courtServiceState({ court, venue });
  const done = ({ success }: { success: boolean }) => success && onDone();
  const engine = COMPETITION_ENGINE;

  if (venueOutOfService) {
    return [
      {
        option: t('courtService.returnVenueToService'),
        onClick: () => returnVenueToService({ venueId: court.venueId, engine, onDone: done }),
      },
    ];
  }

  const options: { option: string; onClick: () => void }[] = [];
  const outOnDate = allDates || dates.includes(date);
  if (!outOnDate && date) {
    options.push({
      option: t('courtService.takeOutOfServiceOnDate', { date }),
      onClick: () =>
        confirmCourtOutOfService({ courtId, courtName, matchUps, date, existingDates: dates, engine, onDone: done }),
    });
  }
  if (!allDates) {
    options.push({
      option: t('courtService.takeOutOfServiceAllDates'),
      onClick: () => confirmCourtOutOfService({ courtId, courtName, matchUps, engine, onDone: done }),
    });
  }
  if (!allDates && dates.includes(date)) {
    options.push({
      option: t('courtService.returnToServiceOnDate', { date }),
      onClick: () => returnCourtToService({ courtId, date, engine, onDone: done }),
    });
  }
  if (allDates || dates.length) {
    options.push({
      option: t('courtService.returnToServiceAllDates'),
      onClick: () => returnCourtToService({ courtId, engine, onDone: done }),
    });
  }
  return options;
}
