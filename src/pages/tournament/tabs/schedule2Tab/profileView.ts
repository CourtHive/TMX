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
  type TemporalAdapter,
  type DemandAdapter,
  type DependencyAdapter,
} from 'courthive-components';
import { competitionEngine, TemporalEngine, temporal } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';

const { calculateCapacityStats } = temporal;

const AVG_MATCH_MINUTES = 75;

let activeControl: SchedulingProfileControl | null = null;

export function renderProfileView(target: HTMLElement): void {
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

  const config: SchedulingProfileConfig = {
    ...setup.config,
    initialProfile: existingProfile,
    onProfileChanged: (profile) => {
      // Persist profile to factory as a tournament extension
      saveProfile(profile);
    },
  };

  activeControl = createSchedulingProfile(config, wrapper);

  // Action bar below the profile
  const actionBar = buildActionBar(setup);
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
  const roundsResult = competitionEngine.getRounds();
  const factoryRounds: any[] = roundsResult?.rounds || [];
  if (!factoryRounds.length) return null;

  const roundCatalog: CatalogRoundItem[] = factoryRounds.map((r: any) => ({
    tournamentId: r.tournamentId || tournamentId,
    eventId: r.eventId,
    eventName: r.eventName || '',
    drawId: r.drawId,
    drawName: r.structureName || r.drawName,
    structureId: r.structureId,
    roundNumber: r.roundNumber,
    roundName: r.roundName,
    matchCountEstimate: r.matchUpsCount,
  }));

  // Schedulable dates
  const schedulableDates = dateRange(startDate, endDate);

  // Build adapters
  const temporalAdapter = buildTemporalAdapter(schedulableDates);
  const demandAdapter = buildDemandAdapter(roundCatalog);
  const dependencyAdapter = buildDependencyAdapter(tournamentId);

  const config: SchedulingProfileConfig = {
    venues,
    roundCatalog,
    schedulableDates,
    venueOrder: venues.map((v) => v.venueId),
    temporalAdapter,
    demandAdapter,
    dependencyAdapter,
  };

  return { tournamentId, venues, roundCatalog, schedulableDates, config };
}

// ============================================================================
// Adapters
// ============================================================================

function buildTemporalAdapter(schedulableDates: string[]): TemporalAdapter {
  // Initialize TemporalEngine from the current tournament record
  let engine: TemporalEngine | null = null;
  try {
    const stateResult = competitionEngine.getState();
    const records = stateResult?.tournamentRecords;
    if (records) {
      // Use the first tournament record for temporal engine
      const record = Object.values(records)[0];
      if (record) {
        engine = new TemporalEngine();
        engine.init(record as any, {
          dayStartTime: '06:00',
          dayEndTime: '22:00',
          slotMinutes: 15,
        });
      }
    }
  } catch {
    // Temporal engine init may fail if no courts configured
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

function saveProfile(profile: SchedulingProfile): void {
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

  competitionEngine.setSchedulingProfile({ schedulingProfile: factoryProfile });
}

// ============================================================================
// Action Bar
// ============================================================================

function buildActionBar(setup: ProfileSetup): HTMLElement {
  const bar = document.createElement('div');
  bar.style.cssText =
    'display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-top: 1px solid var(--sp-line, var(--tmx-border-secondary)); background: var(--sp-panel-bg, var(--tmx-bg-primary)); flex-wrap: wrap;';

  // Schedule button
  const scheduleBtn = document.createElement('button');
  scheduleBtn.className = 'sp-btn sp-btn--success';
  scheduleBtn.innerHTML = '<i class="fa-solid fa-calendar-check" style="margin-right:6px;"></i>Apply Schedule';
  scheduleBtn.addEventListener('click', () => applySchedule(setup, statusEl));
  bar.appendChild(scheduleBtn);

  // Clear button
  const clearBtn = document.createElement('button');
  clearBtn.className = 'sp-btn sp-btn--danger';
  clearBtn.innerHTML = '<i class="fa-solid fa-eraser" style="margin-right:6px;"></i>Clear Profile';
  clearBtn.addEventListener('click', () => {
    competitionEngine.setSchedulingProfile({ schedulingProfile: null });
    tmxToast({ message: 'Scheduling profile cleared', intent: 'is-warning' });
    statusEl.textContent = 'Profile cleared.';
  });
  bar.appendChild(clearBtn);

  // Status text
  const statusEl = document.createElement('span');
  statusEl.style.cssText = 'font-size: 0.75rem; color: var(--sp-muted, var(--tmx-text-muted));';
  statusEl.textContent = 'Drag rounds from the catalog to venue lanes. Click "Apply Schedule" to assign times.';
  bar.appendChild(statusEl);

  return bar;
}

function applySchedule(_setup: ProfileSetup, statusEl: HTMLElement): void {
  if (!activeControl) return;

  const profile = activeControl.getProfile();
  const store = activeControl.getStore();
  const state = store.getState();

  // Check for errors
  if (state.issueIndex.counts.ERROR > 0) {
    tmxToast({
      message: `Cannot apply schedule: ${state.issueIndex.counts.ERROR} error(s) in profile. Fix errors first.`,
      intent: 'is-danger',
    });
    return;
  }

  // Save profile first
  saveProfile(profile);

  // Run the factory scheduler
  const scheduleDates = profile.map((d) => d.scheduleDate);
  const result = competitionEngine.scheduleProfileRounds({ scheduleDates });

  if (result?.error) {
    tmxToast({
      message: `Scheduling failed: ${typeof result.error === 'string' ? result.error : JSON.stringify(result.error)}`,
      intent: 'is-danger',
    });
    statusEl.textContent = 'Scheduling failed. Check console for details.';
    console.error('[schedule2] scheduleProfileRounds error:', result);
    return;
  }

  // Count results
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

  tmxToast({
    message,
    intent: totalOverLimit > 0 ? 'is-warning' : 'is-success',
  });

  statusEl.textContent = message;
  console.log('[schedule2] scheduleProfileRounds result:', result);
}

// ── Helpers ──

function renderEmpty(target: HTMLElement, message: string): void {
  const placeholder = document.createElement('div');
  placeholder.style.cssText =
    'display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; gap: 16px; color: var(--tmx-text-muted);';

  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-layer-group';
  icon.style.cssText = 'font-size: 48px; opacity: 0.3;';
  placeholder.appendChild(icon);

  const desc = document.createElement('div');
  desc.style.cssText = 'font-size: 0.8125rem; max-width: 400px; text-align: center; line-height: 1.5;';
  desc.textContent = message;
  placeholder.appendChild(desc);

  target.appendChild(placeholder);
}

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}
