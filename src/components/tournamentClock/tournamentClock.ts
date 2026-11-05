import { browserTimeZone, resolveVenueFrame, venueLocaleString, venueOffsetMinutesAt } from 'functions/venueTimeFrame';
import { mountDemoClock } from 'components/demoClock/demoClockDock';
import { isDemoTournament } from 'services/clock/demoClock';
import { t } from 'i18n';

// constants
import { SCHEDULING_CONTAINER, TOURNAMENT_CLOCK } from 'constants/tmxConstants';

import './tournamentClock.css';

let timer: ReturnType<typeof setTimeout> | undefined;
let unmountDock: (() => void) | undefined;
// Held, not looked up by id: a schedule re-render drops the bar holding it, and the dock re-places this same panel.
let panel: HTMLElement | undefined;

/**
 * The zone to show a clock for: the tournament's own zone (set on the record or inferred from its venues), and only
 * when the machine's clock reads differently at `nowMs`. Offsets are compared rather than names, so two zones that
 * agree (America/Detroit and America/New_York) show nothing, and two that agree for part of the year show the clock
 * only while they differ. The browser fallback and a refused frame name no tournament zone, so they show nothing.
 */
export function tournamentClockZone(
  frame: { timeZone?: string; source: string },
  nowMs: number,
  machineZone: string,
): string | undefined {
  if (!frame.timeZone || (frame.source !== 'tournament' && frame.source !== 'venue')) return undefined;
  const tournamentOffset = venueOffsetMinutesAt(nowMs, frame.timeZone);
  const machineOffset = venueOffsetMinutesAt(nowMs, machineZone);
  if (tournamentOffset === undefined || machineOffset === undefined) return undefined;
  return tournamentOffset === machineOffset ? undefined : frame.timeZone;
}

/** The short place name for a zone: `America/Los_Angeles` → `Los Angeles`. */
export function zoneCity(zone: string): string {
  return (zone.split('/').pop() ?? zone).replaceAll('_', ' ');
}

/** The Schedule tab is on screen: the clock follows it rather than every caller remembering to remove it. */
function scheduleVisible(): boolean {
  return !!document.getElementById(SCHEDULING_CONTAINER)?.getClientRects().length;
}

export function unmountTournamentClock(): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
  unmountDock?.();
  unmountDock = undefined;
  panel = undefined;
}

function render(panel: HTMLElement, zone: string, nowMs: number): void {
  const time = venueLocaleString(nowMs, { hour: '2-digit', minute: '2-digit' }, 'time');
  const output = document.createElement('output');
  output.textContent = time;
  const city = document.createElement('span');
  city.className = 'tmx-tournament-clock-city';
  city.textContent = zoneCity(zone);
  panel.replaceChildren(output, city);
  const when = venueLocaleString(nowMs, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  const local = new Date(nowMs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  panel.title = t('tournamentClock.title', { when, zone, local });
}

/**
 * The time where the tournament is played, for an administrator auditing a tournament from another zone. Docked
 * centre-bottom in the Schedule tab's bars, the spot the Scheduling Lab's demo clock uses, so it is never shown on a
 * Lab; and only when the tournament's zone reads differently from the machine's. Re-checked every minute boundary.
 */
export function mountTournamentClock(): void {
  const tick = () => {
    timer = undefined;
    const nowMs = Date.now();
    const zone =
      scheduleVisible() && !isDemoTournament()
        ? tournamentClockZone(resolveVenueFrame(), nowMs, browserTimeZone())
        : undefined;
    if (!zone) return unmountTournamentClock();
    if (!panel) {
      panel = document.createElement('div');
      panel.id = TOURNAMENT_CLOCK;
      panel.className = 'tmx-tournament-clock';
      panel.setAttribute('aria-label', t('tournamentClock.ariaLabel'));
      unmountDock = mountDemoClock(panel, {
        fallbackClass: 'tmx-demo-clock-bar tmx-tournament-clock-bar',
        fallbackLabel: 'tournamentClock.ariaLabel',
      });
    }
    render(panel, zone, nowMs);
    timer = setTimeout(tick, 60_000 - (nowMs % 60_000) + 50);
  };
  if (timer !== undefined) clearTimeout(timer);
  // The tab container is shown in the same task that renders it; measure its visibility after layout.
  timer = setTimeout(tick, 0);
}
