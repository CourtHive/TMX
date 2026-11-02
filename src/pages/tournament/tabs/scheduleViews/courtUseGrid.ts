/**
 * The schedule grid's side of courts not in use: grey a court's column (header and cells) when it
 * is not in use on the grid's date, offer Don't use / Use again in the court header menu,
 * and refuse any placement onto such a court.
 *
 * The column is greyed, never hidden — the director still sees the matchUps already on it, which stay
 * where they are. The decisions live in `functions/courtUse`.
 */
import { courtUseState, disabledCourtIds, refusedPlacementCourtIds } from 'functions/courtUse';
import { competitionEngine } from 'services/factory/engine';
import { scheduleToast } from './scheduleToast';
import { t } from 'i18n';
import { confirmCourtDisabled, enableCourt, enableVenue } from 'components/popovers/courtUseActions';

// constants
import { COMPETITION_ENGINE } from 'constants/tmxConstants';

export const DISABLED_COURT_CLASS = 'tmx-court-disabled';
const DISABLED_COURT_HEADER_CLASS = 'tmx-court-disabled-header';
const STYLE_ID = 'tmx-court-use-styles';

/** Theme variables only, so the greying reads in light and dark mode alike. */
function ensureCourtUseStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent =
    `.${DISABLED_COURT_CLASS}{background-color:var(--sp-panel-bg);` +
    'background-image:repeating-linear-gradient(135deg,var(--sp-chip-bg) 0 6px,transparent 6px 12px);' +
    'cursor:not-allowed !important;}' +
    `.${DISABLED_COURT_CLASS} > *{opacity:0.5;filter:grayscale(1);}` +
    `.${DISABLED_COURT_HEADER_CLASS}{color:var(--sp-muted) !important;` +
    'background-image:repeating-linear-gradient(135deg,var(--sp-chip-bg) 0 6px,transparent 6px 12px);}';
  document.head.appendChild(style);
}

function venuesAndCourts(): { courts: any[]; venues: any[] } {
  const { courts = [], venues = [] }: any = competitionEngine.getVenuesAndCourts();
  return { courts, venues };
}

/** The courts not in use on `date`, read from the engine (the grid's own court data may be a plan view). */
export function gridDisabledCourtIds(date: string): Set<string> {
  ensureCourtUseStyles();
  return disabledCourtIds({ ...venuesAndCourts(), date });
}

export function decorateDisabledHeader(th: HTMLElement, courtName: string): void {
  th.classList.add(DISABLED_COURT_HEADER_CLASS);
  th.title = `${courtName} — ${t('courtUse.disabled')}`;
}

/** Greys the cell and shows the not-allowed cursor while something is dragged over it. */
export function decorateDisabledCell(cell: HTMLElement): void {
  cell.classList.add(DISABLED_COURT_CLASS);
  cell.title = t('courtUse.disabled');
  cell.addEventListener('dragover', (e) => {
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
  });
}

/**
 * True (and the director is told why) when `methods` would place a matchUp on a court not in use on its
 * date. Every grid placement — drop, type-ahead, Now strip — passes through here.
 */
export function refuseDisabledPlacement(methods: any[], date: string): boolean {
  const { courts, venues } = venuesAndCourts();
  const refused = refusedPlacementCourtIds({ methods, courts, venues, date });
  if (!refused.length) return false;
  const court = courts.find((c: any) => c.courtId === refused[0]);
  const courtName = court?.courtName || refused[0];
  scheduleToast({ message: t('courtUse.dropRefused', { courtName }), intent: 'is-warning' });
  return true;
}

/** Refuse a drop onto one court before any confirmation is shown for it. */
export function refuseDisabledCourt(courtId: string, date: string): boolean {
  return refuseDisabledPlacement([{ params: { schedule: { courtId, scheduledDate: date } } }], date);
}

/**
 * The court header menu's use options for `date`: not in use on that date or on every date,
 * and the matching returns. A court whose venue is not in use offers only the venue's return.
 */
export function courtUseMenuOptions(params: {
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
  const { allDates, dates, venueDisabled } = courtUseState({ court, venue });
  const done = ({ success }: { success: boolean }) => success && onDone();
  const engine = COMPETITION_ENGINE;

  if (venueDisabled) {
    return [
      {
        option: t('courtUse.enableVenue'),
        onClick: () => enableVenue({ venueId: court.venueId, engine, onDone: done }),
      },
    ];
  }

  const options: { option: string; onClick: () => void }[] = [];
  const outOnDate = allDates || dates.includes(date);
  if (!outOnDate && date) {
    options.push({
      option: t('courtUse.disableOnDate', { date }),
      onClick: () =>
        confirmCourtDisabled({ courtId, courtName, matchUps, date, existingDates: dates, engine, onDone: done }),
    });
  }
  if (!allDates) {
    options.push({
      option: t('courtUse.disableAllDates'),
      onClick: () => confirmCourtDisabled({ courtId, courtName, matchUps, engine, onDone: done }),
    });
  }
  if (!allDates && dates.includes(date)) {
    options.push({
      option: t('courtUse.enableOnDate', { date }),
      onClick: () => enableCourt({ courtId, date, engine, onDone: done }),
    });
  }
  if (allDates || dates.length) {
    options.push({
      option: t('courtUse.enableAllDates'),
      onClick: () => enableCourt({ courtId, engine, onDone: done }),
    });
  }
  return options;
}
