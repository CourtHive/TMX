/**
 * Schedule 2 — Profile View
 *
 * Integrates the courthive-components Scheduling Profile for round-level
 * scheduling (rounds → dates/venues). Extracts factory data (venues, rounds,
 * adapters) and wires the component's onProfileChanged callback to persist
 * the profile via competitionEngine.setSchedulingProfile().
 *
 * The "Apply Schedule" action runs scheduleProfileRounds() on the factory
 * engine which assigns concrete times to matchUps based on the profile.
 */
import {
  createSchedulingProfile,
  type SchedulingProfileConfig,
  type SchedulingProfileControl,
  type CatalogRoundItem,
  type VenueInfo,
  type SchedulingProfile,
  type AvailabilityAdapter,
  type DemandAdapter,
  type DependencyAdapter,
} from 'courthive-components';
import { competitionEngine } from 'services/factory/engine';
import { AvailabilityEngine, availability, unwrapOr } from 'tods-competition-factory';
import { openScheduleResultsDrawer } from './scheduleResultsDrawer';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { scheduleToast } from './scheduleToast';
import { openApplyTimesModal } from './applyTimesModal';
import { getScheduleDateRange } from '../scheduleUtils';
import { openApplyGridModal } from './applyGridModal';
import { hiddenCourtIds } from './visibilityState';
import { context } from 'services/context';

import { COMPETITION_ENGINE, SCHEDULE2_TAB, SCHEDULING_TAB } from 'constants/tmxConstants';

const { calculateCapacityStats } = availability;

const INTENT_SUCCESS = 'is-success';
const INTENT_WARNING = 'is-warning';
const INTENT_DANGER = 'is-danger';
const AVG_MATCH_MINUTES = 75;

let activeControl: SchedulingProfileControl | null = null;

export interface ProfileViewOptions {
  catalogVisible: boolean;
  onToggleCatalog: (visible: boolean) => void;
}

export function renderProfileView(
  target: HTMLElement,
  scheduledDate?: string,
  options?: ProfileViewOptions,
): void {
  target.innerHTML = '';

  const setup = buildProfileSetup();
  if (!setup) {
    renderEmpty(target, 'No events or venues configured. Add events with draws and venues with courts first.');
    return;
  }

  // Wrap in a full-height container for the 3-column layout
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'height: 100%; overflow: hidden;';
  target.appendChild(wrapper);

  // Load existing profile from factory
  const existingProfile = loadExistingProfile(setup);

  // Build the status element first so the header-action handlers and the
  // bottom-bar share the same live reference. Apply* functions update its
  // text with run-specific detail (scheduled counts, errors) that's richer
  // than a toast.
  const statusEl = document.createElement('span');
  statusEl.style.cssText = 'font-size: 0.75rem; color: var(--sp-muted, var(--tmx-text-muted));';
  statusEl.textContent = 'Drag rounds from the catalog to venue lanes. Click "Apply Schedule" to assign times.';

  const headerActions = buildProfileHeaderActions(setup, statusEl, options);

  // Row #3(a) — always-visible capacity meter. Shows demand vs capacity for
  // the selected date with a color cue; clicking it jumps to Availability
  // mode for that date so the TD can extend hours without leaving Profile
  // when the meter is yellow / red. Refreshes every time the user reshapes
  // the profile draft.
  const capacityBadge = buildCapacityBadge({
    scheduledDate: scheduledDate ?? '',
    availabilityAdapter: setup.config.availabilityAdapter,
    demandAdapter: setup.config.demandAdapter,
    tournamentId: setup.tournamentId,
  });
  headerActions.leading.push(capacityBadge.element);

  const config: SchedulingProfileConfig = {
    ...setup.config,
    selectedDate: scheduledDate,
    initialProfile: existingProfile,
    headerActions: headerActions.buttons,
    titleLeadingActions: headerActions.leading,
    onProfileChanged: (profile) => {
      // Persist profile to factory as a tournament extension
      saveProfile(profile);
      capacityBadge.refresh(profile);
    },
    onFixAction: (action) => {
      // Row #1 of the scheduling workspace tracker: when an issue exposes a
      // 'Tune availability' button (DATE_UNAVAILABLE / DAY_OVERLOAD), jump the
      // workspace into Availability mode pre-focused on the date.
      if (action.kind === 'OPEN_AVAILABILITY_GRID' && action.date) {
        const tournamentId = competitionEngine.getTournamentInfo()?.tournamentInfo?.tournamentId;
        if (tournamentId) {
          context.router?.navigate(
            `/tournament/${tournamentId}/${SCHEDULING_TAB}/${action.date}/availability`,
          );
        }
      }
    },
  };

  activeControl = createSchedulingProfile(config, wrapper);

  // Initial badge refresh with the loaded profile draft so the meter shows
  // real numbers before the user touches anything.
  capacityBadge.refresh(existingProfile ?? []);

  // After the panel mounts, observe its header width and reveal button labels
  // when there's room. Icon-only below the threshold; labels appear once the
  // header has space for them.
  installResponsiveLabels(wrapper, headerActions);

  // Slimmer bottom bar: status text + (conditional) Apply-scope pill.
  // The four buttons moved into the Day Plan header (see headerActions above).
  const actionBar = buildActionBar(statusEl);
  target.appendChild(actionBar);
}

export function destroyProfileView(): void {
  if (activeControl) {
    activeControl.destroy();
    activeControl = null;
  }
}

// ============================================================================
// Factory Data Extraction
// ============================================================================

interface ProfileSetup {
  tournamentId: string;
  venues: VenueInfo[];
  roundCatalog: CatalogRoundItem[];
  schedulableDates: string[];
  config: SchedulingProfileConfig;
}

function buildProfileSetup(): ProfileSetup | null {
  const { startDate, endDate } = competitionEngine.getCompetitionDateRange();
  if (!startDate || !endDate) return null;

  // Get tournament info
  const tournamentInfo = competitionEngine.getTournamentInfo();
  const tournamentId = tournamentInfo?.tournamentInfo?.tournamentId || '';

  // Extract venues
  const { venues: factoryVenues } = competitionEngine.getVenuesAndCourts() || {};
  if (!factoryVenues?.length) return null;

  const venues: VenueInfo[] = factoryVenues.map((v: any) => ({
    venueId: v.venueId,
    name: v.venueName || v.venueId,
  }));

  // Extract round catalog
  const { rounds: factoryRounds = [] } = unwrapOr(competitionEngine.getRounds(), {
    rounds: [] as any[],
  });
  if (!factoryRounds.length) return null;

  const roundCatalog: CatalogRoundItem[] = factoryRounds.map((r: any) => {
    // Prefer structureName (e.g. "Main Draw", "Consolation"); fall back to drawName only if it's not a UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(r.drawName || '');
    const drawName = r.structureName || (!isUUID ? r.drawName : '') || '';

    // Build a human-readable round name from matchUps if factory gives raw format
    const rawRound = r.roundName || '';
    const roundName = rawRound.startsWith('rn=')
      ? r.matchUps?.[0]?.roundName || `Round ${r.roundNumber}`
      : rawRound || `Round ${r.roundNumber}`;

    return {
      tournamentId: r.tournamentId || tournamentId,
      eventId: r.eventId,
      eventName: r.eventName || '',
      drawId: r.drawId,
      drawName,
      structureId: r.structureId,
      roundNumber: r.roundNumber,
      roundName,
      matchCountEstimate: r.matchUpsCount,
    };
  });

  // Schedulable dates (respects activeDates when present)
  const schedulableDates = getScheduleDateRange();

  // Build adapters
  const availabilityAdapter = buildAvailabilityAdapter(schedulableDates);
  const demandAdapter = buildDemandAdapter(roundCatalog);
  const dependencyAdapter = buildDependencyAdapter(tournamentId);

  const config: SchedulingProfileConfig = {
    venues,
    roundCatalog,
    schedulableDates,
    hideLeft: true,
    catalogSide: 'left',
    venueOrder: venues.map((v) => v.venueId),
    availabilityAdapter,
    demandAdapter,
    dependencyAdapter,
  };

  return { tournamentId, venues, roundCatalog, schedulableDates, config };
}

// ============================================================================
// Adapters
// ============================================================================

function buildAvailabilityAdapter(schedulableDates: string[]): AvailabilityAdapter {
  // Initialize AvailabilityEngine from the current tournament record
  let engine: AvailabilityEngine | null = null;
  try {
    const stateResult = competitionEngine.getState();
    const records = stateResult?.tournamentRecords;
    if (records) {
      // Use the first tournament record for availability engine
      const record = Object.values(records)[0];
      if (record) {
        engine = new AvailabilityEngine();
        engine.init(record as any, {
          dayStartTime: '06:00',
          dayEndTime: '22:00',
          slotMinutes: 15,
        });
      }
    }
  } catch {
    // AvailabilityEngine init may fail if no courts configured
  }

  return {
    isDateAvailable: (date: string) => {
      if (!schedulableDates.includes(date)) {
        return { ok: false, reason: 'Date outside competition range' };
      }
      if (!engine) return { ok: true };

      const curve = engine.getCapacityCurve(date);
      const stats = calculateCapacityStats(curve);
      if (stats.totalCourtHours <= 0) {
        return { ok: false, reason: 'No court capacity on this date' };
      }
      return { ok: true };
    },
    getDayCapacityMinutes: (date: string) => {
      if (!engine) return 0;
      const curve = engine.getCapacityCurve(date);
      const stats = calculateCapacityStats(curve);
      return Math.round((stats.totalAvailableHours ?? stats.totalCourtHours) * 60);
    },
  };
}

function buildDemandAdapter(roundCatalog: CatalogRoundItem[]): DemandAdapter {
  return {
    estimateDayDemandMinutes: (_date: string, profile: SchedulingProfile) => {
      const day = profile.find((d) => d.scheduleDate === _date);
      if (!day) return 0;

      let totalMatches = 0;
      for (const venue of day.venues) {
        for (const round of venue.rounds) {
          const catalogEntry = roundCatalog.find(
            (c) =>
              c.structureId === round.structureId &&
              c.roundNumber === round.roundNumber &&
              c.drawId === round.drawId,
          );
          totalMatches += catalogEntry?.matchCountEstimate ?? round.matchCountEstimate ?? 4;
        }
      }
      return totalMatches * AVG_MATCH_MINUTES;
    },
  };
}

function buildDependencyAdapter(tournamentId: string): DependencyAdapter {
  const { matchUps } = competitionEngine.allCompetitionMatchUps({ inContext: true }) || {};
  const { matchUpDependencies } = competitionEngine.getMatchUpDependencies({ matchUps }) || {};

  // Build matchUpId → roundKeyString index
  const matchUpToRoundKey = new Map<string, string>();
  for (const mu of matchUps ?? []) {
    const key = [
      (mu as any).tournamentId || tournamentId,
      mu.eventId,
      mu.drawId,
      mu.structureId,
      mu.roundNumber,
    ].join('|');
    matchUpToRoundKey.set(mu.matchUpId, key);
  }

  // Build round-level dependency map
  const roundDeps = new Map<string, Set<string>>();
  for (const [matchUpId, deps] of Object.entries(matchUpDependencies ?? {})) {
    const roundKey = matchUpToRoundKey.get(matchUpId);
    if (!roundKey) continue;

    for (const depMatchUpId of (deps as any).matchUpIds ?? []) {
      const depRoundKey = matchUpToRoundKey.get(depMatchUpId);
      if (!depRoundKey || depRoundKey === roundKey) continue;

      const set = roundDeps.get(roundKey) ?? new Set();
      set.add(depRoundKey);
      roundDeps.set(roundKey, set);
    }
  }

  return {
    getRoundDependencies: (key: string): string[] => [...(roundDeps.get(key) ?? [])],
  };
}

// ============================================================================
// Profile Persistence
// ============================================================================

function loadExistingProfile(setup: ProfileSetup): SchedulingProfile | undefined {
  const result = competitionEngine.getSchedulingProfile();
  const existing = result?.schedulingProfile;
  if (!existing?.length) return undefined;

  // Enrich with display fields from the round catalog
  for (const day of existing) {
    for (const venue of day.venues || []) {
      for (const round of venue.rounds || []) {
        const catalogEntry = setup.roundCatalog.find(
          (c) =>
            c.structureId === round.structureId &&
            c.roundNumber === round.roundNumber &&
            c.drawId === round.drawId,
        );
        if (catalogEntry) {
          round.eventName = catalogEntry.eventName;
          round.drawName = catalogEntry.drawName;
          round.roundName = catalogEntry.roundName;
          round.matchCountEstimate = catalogEntry.matchCountEstimate;
        }
      }
    }
  }

  return existing;
}

function saveProfile(profile: SchedulingProfile, callback?: () => void): void {
  // Strip display-only fields before persisting
  const factoryProfile = profile.map((day) => ({
    scheduleDate: day.scheduleDate,
    venues: day.venues.map((v) => ({
      venueId: v.venueId,
      rounds: v.rounds.map((r) => {
        const base: any = {
          tournamentId: r.tournamentId,
          eventId: r.eventId,
          drawId: r.drawId,
          structureId: r.structureId,
          roundNumber: r.roundNumber,
        };
        if (r.roundSegment) base.roundSegment = r.roundSegment;
        if (r.notBeforeTime) base.notBeforeTime = r.notBeforeTime;
        return base;
      }),
    })),
  }));

  mutationRequest({
    methods: [{ method: 'setSchedulingProfile', params: { schedulingProfile: factoryProfile } }],
    engine: COMPETITION_ENGINE,
    callback: () => callback?.(),
  });
}

// ============================================================================
// Action Bar
// ============================================================================

interface ProfileHeaderActions {
  /** Rendered immediately before the "Day Plan" title — co-located with the
   *  catalog it controls (left column). */
  leading: HTMLButtonElement[];
  /** Right-aligned action buttons (Clear / Apply Times / Apply Grid / Save). */
  buttons: HTMLButtonElement[];
  labels: HTMLSpanElement[];
}

const ACCENT_GREEN = 'var(--tmx-accent-green, #10b981)';

const BTN_BASE = [
  'font-size: 0.75rem',
  'padding: 4px 8px',
  'border-radius: 6px',
  'border: 1px solid var(--tmx-border-primary)',
  'cursor: pointer',
  'display: inline-flex',
  'align-items: center',
  'transition: background 0.15s, opacity 0.15s, color 0.15s',
].join('; ');

// Tinted pill for view-state toggles (matches the grid view's catalog toggle).
const TOGGLE_BG_PRESSED = 'rgba(59, 130, 246, 0.18)';

function buildCatalogToggle(initial: boolean, onChange: (visible: boolean) => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.innerHTML = '<i class="fa-solid fa-table-columns" style="font-size: 0.75rem;"></i>';
  const applyState = (pressed: boolean) => {
    btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    btn.style.cssText =
      BTN_BASE +
      `; color: var(--tmx-color-primary)` +
      `; background: ${pressed ? TOGGLE_BG_PRESSED : 'transparent'}` +
      `; opacity: ${pressed ? '1' : '0.45'}`;
    btn.title = pressed ? 'Hide round catalog' : 'Show round catalog';
  };
  applyState(initial);
  btn.addEventListener('click', () => {
    const next = btn.getAttribute('aria-pressed') !== 'true';
    applyState(next);
    onChange(next);
  });
  return btn;
}

function buildProfileHeaderActions(
  setup: ProfileSetup,
  statusEl: HTMLElement,
  options?: ProfileViewOptions,
): ProfileHeaderActions {
  const leading: HTMLButtonElement[] = [];
  const buttons: HTMLButtonElement[] = [];
  const labels: HTMLSpanElement[] = [];

  // Catalog toggle sits in the leading slot, next to the "Day Plan" title —
  // co-located with the catalog it controls (left column).
  if (options) {
    leading.push(buildCatalogToggle(options.catalogVisible, options.onToggleCatalog));
  }

  const makeIcon = (
    icon: string,
    label: string,
    hover: string,
    color: string,
    onClick: () => void,
  ): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.style.cssText = BTN_BASE + `; background: transparent; color: ${color}`;
    btn.title = hover;
    btn.innerHTML = `<i class="fa-solid ${icon}" style="font-size: 0.75rem;"></i>`;
    // Label span — hidden by default; the resize observer reveals it when
    // the panel header has room.
    const span = document.createElement('span');
    span.textContent = label;
    span.style.marginLeft = '6px';
    span.style.display = 'none';
    btn.appendChild(span);
    btn.addEventListener('click', onClick);
    buttons.push(btn);
    labels.push(span);
    return btn;
  };

  makeIcon('fa-eraser', 'Clear Profile', 'Clear Profile', 'var(--tmx-accent-red, #ef4444)', () => {
    mutationRequest({
      methods: [{ method: 'setSchedulingProfile', params: { schedulingProfile: null } }],
      engine: COMPETITION_ENGINE,
      callback: () => {
        scheduleToast({ message: 'Scheduling profile cleared', intent: INTENT_WARNING });
        statusEl.textContent = 'Profile cleared.';
      },
    });
  });

  makeIcon(
    'fa-clock',
    'Apply Times',
    'Apply Times — assign scheduled times using the Garman algorithm',
    ACCENT_GREEN,
    () => applySchedule(setup, statusEl),
  );

  makeIcon(
    'fa-table-cells',
    'Apply Grid',
    'Apply Grid — assign court grid positions without times (pro scheduling)',
    ACCENT_GREEN,
    () => applyGrid(setup, statusEl),
  );

  makeIcon('fa-floppy-disk', 'Save Profile', 'Save Profile', 'var(--tmx-color-primary)', () => {
    if (!activeControl) return;
    saveProfile(activeControl.getProfile(), () => {
      scheduleToast({ message: 'Scheduling profile saved', intent: INTENT_SUCCESS });
      statusEl.textContent = 'Profile saved.';
    });
  });

  return { leading, buttons, labels };
}

// Width below which we render icons only. Tuned so the four labelled buttons
// plus the "Day Plan" title fit comfortably without wrapping.
const LABEL_BREAKPOINT_PX = 560;

function installResponsiveLabels(wrapper: HTMLElement, actions: ProfileHeaderActions): void {
  // Defer until after createSchedulingProfile has appended its DOM so the
  // panel header is mounted. Anchor to the unique `.sp-panel-actions`
  // container (only the venue board carries one) and walk up to *its*
  // panel header — `querySelector('.sp-panel-header')` would otherwise
  // resolve to the date-strip header in the left column.
  queueMicrotask(() => {
    const actionsEl = wrapper.querySelector('.sp-panel-actions') as HTMLElement | null;
    const header = actionsEl?.closest('.sp-panel-header') as HTMLElement | null;
    if (!header) return;
    const apply = (width: number) => {
      const show = width >= LABEL_BREAKPOINT_PX;
      for (const span of actions.labels) span.style.display = show ? 'inline' : 'none';
    };
    apply(header.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) apply(entry.contentRect.width);
    });
    observer.observe(header);
  });
}

function buildActionBar(statusEl: HTMLElement): HTMLElement {
  const bar = document.createElement('div');
  bar.style.cssText =
    'display: flex; align-items: center; gap: 12px; padding: 8px 16px; border-top: 1px solid var(--sp-line, var(--tmx-border-secondary)); background: var(--sp-panel-bg, var(--tmx-bg-primary)); flex-wrap: wrap;';

  const scopePill = buildApplyScopePill();
  if (scopePill) bar.appendChild(scopePill);

  bar.appendChild(statusEl);

  return bar;
}

/**
 * Renders an "Apply scope" pill when courts are hidden in gridView, so the
 * operator knows the upcoming Apply runs against a subset. Click jumps to
 * gridView (where visibility is adjusted).
 */
function buildApplyScopePill(): HTMLElement | null {
  if (hiddenCourtIds.size === 0) return null;
  const { courts } = competitionEngine.getVenuesAndCourts() || {};
  const total = Array.isArray(courts) ? (courts as any[]).length : 0;
  if (!total) return null;
  const visible = total - hiddenCourtIds.size;

  const pill = document.createElement('button');
  pill.type = 'button';
  pill.title = 'Court visibility set in the Grid view restricts where Apply Times / Apply Grid will operate. Click to adjust.';
  pill.style.cssText = [
    'display: inline-flex',
    'align-items: center',
    'gap: 6px',
    'padding: 4px 10px',
    'border-radius: 999px',
    'border: 1px solid var(--tmx-accent-blue, #3b82f6)',
    'background: transparent',
    'color: var(--tmx-accent-blue, #3b82f6)',
    'font-size: 0.75rem',
    'cursor: pointer',
  ].join('; ');
  pill.innerHTML = `<i class="fa-solid fa-eye" style="font-size: 0.6875rem;"></i><span>Apply scope: ${visible} of ${total} courts</span>`;
  pill.addEventListener('click', () => {
    const tournamentId = competitionEngine.getTournamentInfo().tournamentInfo?.tournamentId;
    const date = (context as any).displayed?.selectedScheduleDate;
    if (!tournamentId) return;
    const path = date
      ? `/tournament/${tournamentId}/${SCHEDULE2_TAB}/${date}/grid`
      : `/tournament/${tournamentId}/${SCHEDULE2_TAB}`;
    context.router?.navigate(path);
  });
  return pill;
}

/**
 * Returns the visible court IDs (all courts minus hidden ones), or undefined
 * when no courts are hidden — matching the factory default of "consider all
 * courts" so we don't send a redundant payload.
 */
function getVisibleCourtIdsOrUndefined(): string[] | undefined {
  if (hiddenCourtIds.size === 0) return undefined;
  const { courts } = competitionEngine.getVenuesAndCourts() || {};
  if (!Array.isArray(courts)) return undefined;
  return (courts as any[])
    .filter((c) => !hiddenCourtIds.has(c.courtId))
    .map((c) => c.courtId);
}

function hasAnyPlannedRounds(profile: SchedulingProfile | undefined): boolean {
  if (!profile?.length) return false;
  return profile.some((day) => day.venues?.some((v) => Array.isArray(v.rounds) && v.rounds.length > 0));
}

function applySchedule(_setup: ProfileSetup, statusEl: HTMLElement): void {
  if (!activeControl) return;

  const profile = activeControl.getProfile();
  const store = activeControl.getStore();
  const state = store.getState();

  // No-op when the Day Plan is empty: nothing to schedule.
  if (!hasAnyPlannedRounds(profile)) {
    scheduleToast({
      message: 'No rounds in the Day Plan. Drag rounds from the catalog into venue lanes first.',
      intent: INTENT_WARNING,
    });
    return;
  }

  // Check for errors
  if (state.issueIndex.counts.ERROR > 0) {
    scheduleToast({
      message: `Cannot apply schedule: ${state.issueIndex.counts.ERROR} error(s) in profile. Fix errors first.`,
      intent: INTENT_DANGER,
    });
    return;
  }

  // Confirm policy choice before running the scheduler.
  openApplyTimesModal({
    onApply: ({ selected, mustAttach }) => runScheduleWithPolicy(profile, statusEl, selected.definition, mustAttach),
  });
}

function runScheduleWithPolicy(
  profile: SchedulingProfile,
  statusEl: HTMLElement,
  policyDefinitions: Record<string, any>,
  mustAttach: boolean,
): void {
  // Save profile first, then optionally attach the chosen policy, then run
  // the factory scheduler.
  saveProfile(profile, () => {
    const scheduleDates = profile.map((d) => d.scheduleDate);
    const courtIds = getVisibleCourtIdsOrUndefined();
    const params: any = { scheduleDates };
    if (courtIds) params.courtIds = courtIds;

    const methods: any[] = [];
    if (mustAttach) {
      methods.push({ method: 'attachPolicies', params: { policyDefinitions } });
    }
    methods.push({ method: 'scheduleProfileRounds', params });

    mutationRequest({
      methods,
      engine: COMPETITION_ENGINE,
      callback: (eqResult: any) => {
        // executionQueue wraps multiple results; the scheduling result is last.
        const results = eqResult?.results;
        const result = Array.isArray(results) ? results[results.length - 1] : eqResult;

        if (result?.error || eqResult?.error) {
          const err = result?.error || eqResult?.error;
          scheduleToast({
            message: `Scheduling failed: ${typeof err === 'string' ? err : JSON.stringify(err)}`,
            intent: INTENT_DANGER,
          });
          statusEl.textContent = 'Scheduling failed. Check console for details.';
          console.error('[schedule2] scheduleProfileRounds error:', eqResult);
          return;
        }

        const scheduledIds = result?.scheduledMatchUpIds || {};
        let totalScheduled = 0;
        for (const ids of Object.values(scheduledIds)) {
          totalScheduled += (ids as string[]).length;
        }

        const overLimitIds = result?.overLimitMatchUpIds || {};
        let totalOverLimit = 0;
        for (const ids of Object.values(overLimitIds)) {
          totalOverLimit += (ids as string[]).length;
        }

        const dateCount = (result?.scheduledDates || []).length;
        const overLimitSuffix = totalOverLimit > 0 ? ` ${totalOverLimit} over capacity limit.` : '';
        const message = `Scheduled ${totalScheduled} matchUps across ${dateCount} dates.${overLimitSuffix}`;

        scheduleToast({
          message,
          intent: totalOverLimit > 0 ? INTENT_WARNING : INTENT_SUCCESS,
        });

        statusEl.textContent = message;

        // Surface the full scheduler return value (deferred matchUps, conflicts,
        // no-time, etc.) — the toast only summarizes Scheduled + Over Limit.
        // Skip the drawer when nothing beyond Scheduled needs attention.
        if (result && hasActionableResults(result)) openScheduleResultsDrawer(result);
      },
    });
  });
}

function hasActionableResults(result: any): boolean {
  const dateMapHasEntries = (m: any) =>
    m && Object.values(m).some((v) => (Array.isArray(v) ? v.length : Object.keys(v ?? {}).length) > 0);
  return (
    dateMapHasEntries(result.overLimitMatchUpIds) ||
    dateMapHasEntries(result.noTimeMatchUpIds) ||
    dateMapHasEntries(result.recoveryTimeDeferredMatchUpIds) ||
    dateMapHasEntries(result.dependencyDeferredMatchUpIds) ||
    dateMapHasEntries(result.requestConflicts)
  );
}

function applyGrid(_setup: ProfileSetup, statusEl: HTMLElement): void {
  if (!activeControl) return;

  const profile = activeControl.getProfile();
  const store = activeControl.getStore();
  const state = store.getState();

  // No-op when the Day Plan is empty: nothing to place on the grid.
  if (!hasAnyPlannedRounds(profile)) {
    scheduleToast({
      message: 'No rounds in the Day Plan. Drag rounds from the catalog into venue lanes first.',
      intent: INTENT_WARNING,
    });
    return;
  }

  if (state.issueIndex.counts.ERROR > 0) {
    scheduleToast({
      message: `Cannot apply grid: ${state.issueIndex.counts.ERROR} error(s) in profile. Fix errors first.`,
      intent: INTENT_DANGER,
    });
    return;
  }

  openApplyGridModal({
    onApply: ({ selected, mustAttach }) => runGridWithPolicy(profile, statusEl, selected, mustAttach),
  });
}

function runGridWithPolicy(
  profile: SchedulingProfile,
  statusEl: HTMLElement,
  selectedPolicy: { definition: Record<string, any> } | null,
  mustAttach: boolean,
): void {
  saveProfile(profile, () => {
    const scheduleDates = profile.map((d) => d.scheduleDate);
    const courtIds = getVisibleCourtIdsOrUndefined();
    const params: any = { scheduleDates };
    if (courtIds) params.courtIds = courtIds;

    // Extract daily limits from the chosen policy (if any). Mirrors what the
    // factory's `getMatchUpDailyLimits` would read from an attached policy.
    const matchUpDailyLimits = selectedPolicy?.definition?.scheduling?.defaultDailyLimits;
    if (matchUpDailyLimits) params.matchUpDailyLimits = matchUpDailyLimits;

    const methods: any[] = [];
    if (selectedPolicy && mustAttach) {
      methods.push({ method: 'attachPolicies', params: { policyDefinitions: selectedPolicy.definition } });
    }
    methods.push({ method: 'scheduleProfileGrid', params });

    mutationRequest({
      methods,
      engine: COMPETITION_ENGINE,
      callback: (eqResult: any) => {
        const results = eqResult?.results;
        const result = Array.isArray(results) ? results[results.length - 1] : eqResult;

        if (result?.error || eqResult?.error) {
          const err = result?.error || eqResult?.error;
          scheduleToast({
            message: `Grid scheduling failed: ${typeof err === 'string' ? err : JSON.stringify(err)}`,
            intent: INTENT_DANGER,
          });
          statusEl.textContent = 'Grid scheduling failed.';
          return;
        }

        const scheduledIds = result?.scheduledMatchUpIds || {};
        let totalScheduled = 0;
        for (const ids of Object.values(scheduledIds)) {
          totalScheduled += (ids as string[]).length;
        }

        const notScheduledIds = result?.notScheduledMatchUpIds || {};
        let totalNotScheduled = 0;
        for (const ids of Object.values(notScheduledIds)) {
          totalNotScheduled += (ids as string[]).length;
        }

        const overLimitIds = result?.overLimitMatchUpIds || {};
        let totalOverLimit = 0;
        for (const ids of Object.values(overLimitIds)) {
          totalOverLimit += (ids as string[]).length;
        }

        const dateCount = (result?.scheduledDates || []).length;
        const segments = [`Placed ${totalScheduled} matchUps on grid across ${dateCount} dates`];
        if (totalNotScheduled > 0) segments.push(`${totalNotScheduled} could not be placed`);
        if (totalOverLimit > 0) segments.push(`${totalOverLimit} over daily limit`);
        const message = segments.join(' — ') + '.';

        scheduleToast({
          message,
          intent: totalNotScheduled > 0 || totalOverLimit > 0 ? INTENT_WARNING : INTENT_SUCCESS,
        });

        statusEl.textContent = message;
      },
    });
  });
}

// ── Helpers ──

function renderEmpty(target: HTMLElement, message: string): void {
  const placeholder = document.createElement('div');
  placeholder.style.cssText =
    'display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; gap: 16px; color: var(--tmx-text-muted);';

  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-layer-group';
  icon.style.cssText = 'font-size: 3rem; opacity: 0.3;';
  placeholder.appendChild(icon);

  const desc = document.createElement('div');
  desc.style.cssText = 'font-size: 0.8125rem; max-width: 400px; text-align: center; line-height: 1.5;';
  desc.textContent = message;
  placeholder.appendChild(desc);

  target.appendChild(placeholder);
}

// ============================================================================
// Row #3(a) — Capacity Meter
// ============================================================================

interface CapacityBadgeOptions {
  scheduledDate: string;
  availabilityAdapter?: AvailabilityAdapter;
  demandAdapter?: DemandAdapter;
  tournamentId: string;
}

interface CapacityBadgeHandle {
  element: HTMLButtonElement;
  refresh: (profile: SchedulingProfile) => void;
}

/**
 * Build the always-visible capacity meter that sits in the Day Plan title's
 * leading slot. Renders demand vs available hours for the selected date with
 * a status dot (green / yellow / red). Clicking jumps to the workspace's
 * Availability mode for that date so the TD can extend court hours without
 * leaving Profile. Row #3(a) of the scheduling workspace tracker.
 */
function buildCapacityBadge(opts: CapacityBadgeOptions): CapacityBadgeHandle {
  const { scheduledDate, availabilityAdapter, demandAdapter, tournamentId } = opts;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.title = 'Click to adjust court availability for this date';
  btn.style.cssText =
    BTN_BASE +
    '; gap: 6px; padding: 4px 10px; background: var(--tmx-bg-primary); color: var(--tmx-color-primary); font-weight: 600; white-space: nowrap;';

  const dot = document.createElement('span');
  dot.style.cssText = 'width: 8px; height: 8px; border-radius: 50%; background: var(--tmx-text-muted, #888); flex-shrink: 0;';
  const text = document.createElement('span');
  text.textContent = '— / —';
  btn.appendChild(dot);
  btn.appendChild(text);

  btn.addEventListener('click', () => {
    if (!tournamentId) return;
    context.router?.navigate(`/tournament/${tournamentId}/${SCHEDULING_TAB}/${scheduledDate}/availability`);
  });

  function refresh(profile: SchedulingProfile): void {
    if (!availabilityAdapter?.getDayCapacityMinutes || !demandAdapter?.estimateDayDemandMinutes) {
      text.textContent = 'availability';
      dot.style.background = 'var(--tmx-text-muted, #888)';
      return;
    }
    const capMin = availabilityAdapter.getDayCapacityMinutes(scheduledDate);
    const demMin = demandAdapter.estimateDayDemandMinutes(scheduledDate, profile);
    const capH = Math.round((capMin / 60) * 10) / 10;
    const demH = Math.round((demMin / 60) * 10) / 10;
    text.textContent = `${demH}h / ${capH}h`;

    let color = ACCENT_GREEN;
    if (capMin <= 0) color = 'var(--tmx-text-muted, #888)';
    else if (demMin > capMin) color = 'var(--tmx-accent-red, #ef4444)';
    else if (demMin > capMin * 0.85) color = 'var(--tmx-accent-orange, #f59e0b)';
    dot.style.background = color;
  }

  return { element: btn, refresh };
}

