import { browserTimeZone, resolveVenueFrame, venueLocaleString, venueOffsetMinutesAt } from 'functions/venueTimeFrame';
import { isDemoTournament } from 'services/clock/demoClock';
import { t } from 'i18n';

// constants
import { TOURNAMENT_CLOCK, TOURNAMENT_SETTINGS } from 'constants/tmxConstants';

import './tournamentClock.css';

const DOCK_ATTRIBUTE = 'tmxTournamentClockDock';

let timer: ReturnType<typeof setTimeout> | undefined;

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

/** The Settings tab is on screen: the clock follows it rather than every caller remembering to remove it. */
function settingsVisible(): boolean {
  return !!document.getElementById(TOURNAMENT_SETTINGS)?.getClientRects().length;
}

export function unmountTournamentClock(): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
  document.getElementById(TOURNAMENT_CLOCK)?.remove();
  delete document.documentElement.dataset[DOCK_ATTRIBUTE];
}

function render(bar: HTMLElement, zone: string, nowMs: number): void {
  const time = venueLocaleString(nowMs, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }, 'time');
  const date = venueLocaleString(nowMs, { weekday: 'short', month: 'short', day: 'numeric' }, 'date');
  const label = document.createElement('span');
  label.className = 'tmx-tournament-clock-label';
  label.textContent = t('tournamentClock.label');
  const output = document.createElement('output');
  output.textContent = time;
  const detail = document.createElement('span');
  detail.className = 'tmx-tournament-clock-detail';
  detail.textContent = `${date} · ${zone}`;
  bar.replaceChildren(label, output, detail);
  const local = new Date(nowMs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  bar.title = t('tournamentClock.title', { zone, local });
}

/**
 * A bottom-centre clock showing the time where the tournament is played, for an administrator auditing a tournament
 * from another zone. Shown on the Settings tab only, never on a Scheduling Lab (whose demo clock owns that spot),
 * and only when the tournament's zone reads differently from the machine's. Re-checked every minute boundary.
 */
export function mountTournamentClock(): void {
  const tick = () => {
    timer = undefined;
    const nowMs = Date.now();
    const zone =
      settingsVisible() && !isDemoTournament()
        ? tournamentClockZone(resolveVenueFrame(), nowMs, browserTimeZone())
        : undefined;
    if (!zone) return unmountTournamentClock();
    let bar = document.getElementById(TOURNAMENT_CLOCK);
    if (!bar) {
      bar = document.createElement('footer');
      bar.id = TOURNAMENT_CLOCK;
      bar.className = 'tmx-tournament-clock-bar';
      bar.setAttribute('aria-label', t('tournamentClock.ariaLabel'));
      (document.querySelector('.app_shell') ?? document.body).append(bar);
      document.documentElement.dataset[DOCK_ATTRIBUTE] = 'true';
    }
    render(bar, zone, nowMs);
    timer = setTimeout(tick, 60_000 - (nowMs % 60_000) + 50);
  };
  if (timer !== undefined) clearTimeout(timer);
  // The tab container is shown in the same task that renders it; measure its visibility after layout.
  timer = setTimeout(tick, 0);
}
