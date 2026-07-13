import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  getTournamentCalendarEntry: vi.fn(),
  upsertCalendarEntry: vi.fn(),
  findAllTournaments: vi.fn(),
  findAllProviders: vi.fn(),
  clearAllProviderCalendars: vi.fn(),
}));

vi.mock('services/factory/engine', () => ({
  tournamentEngine: { getTournamentCalendarEntry: h.getTournamentCalendarEntry },
}));
vi.mock('./tmx2db', () => ({
  tmx2db: {
    upsertCalendarEntry: h.upsertCalendarEntry,
    findAllTournaments: h.findAllTournaments,
    findAllProviders: h.findAllProviders,
    clearAllProviderCalendars: h.clearAllProviderCalendars,
  },
}));

import { maintainLocalCalendarEntry, readLocalCalendarEntries, resetLocalCalendar } from './localCalendar';

const store: Record<string, string> = {};

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(store)) delete store[key];
  (globalThis as any).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  };
  h.getTournamentCalendarEntry.mockImplementation(({ tournamentRecord }: any) => ({
    tournamentId: tournamentRecord.tournamentId,
    providerId: tournamentRecord.parentOrganisation?.organisationId,
    searchText: (tournamentRecord.tournamentName || '').toLowerCase(),
    tournament: { tournamentName: tournamentRecord.tournamentName },
  }));
  h.upsertCalendarEntry.mockResolvedValue(undefined);
  h.findAllTournaments.mockResolvedValue([]);
  h.findAllProviders.mockResolvedValue([]);
  h.clearAllProviderCalendars.mockResolvedValue(0);
});

afterEach(() => {
  delete (globalThis as any).localStorage;
});

describe('maintainLocalCalendarEntry', () => {
  it('upserts a derived entry under the provider bucket', async () => {
    await maintainLocalCalendarEntry({
      tournamentId: 't1',
      tournamentName: 'Open',
      parentOrganisation: { organisationId: 'prov-1' },
    });
    expect(h.upsertCalendarEntry).toHaveBeenCalledWith('prov-1', expect.objectContaining({ tournamentId: 't1' }));
  });

  it('buckets provider-less (demo) tournaments under __local__', async () => {
    await maintainLocalCalendarEntry({ tournamentId: 't2', tournamentName: 'Demo' });
    expect(h.upsertCalendarEntry).toHaveBeenCalledWith('__local__', expect.objectContaining({ tournamentId: 't2' }));
  });

  it('no-ops without a tournamentId', async () => {
    await maintainLocalCalendarEntry({ tournamentName: 'x' });
    expect(h.upsertCalendarEntry).not.toHaveBeenCalled();
  });

  it('never throws when derivation fails (save must not break)', async () => {
    h.getTournamentCalendarEntry.mockImplementation(() => {
      throw new Error('boom');
    });
    await expect(maintainLocalCalendarEntry({ tournamentId: 't3' })).resolves.toBeUndefined();
    expect(h.upsertCalendarEntry).not.toHaveBeenCalled();
  });
});

describe('readLocalCalendarEntries', () => {
  it('migrates full records into entries once, then flattens provider calendars', async () => {
    h.findAllTournaments.mockResolvedValue([
      { tournamentId: 't1', tournamentName: 'A', parentOrganisation: { organisationId: 'p1' } },
      { tournamentId: 't2', tournamentName: 'B' },
    ]);
    h.findAllProviders.mockResolvedValue([
      { providerId: 'p1', calendar: [{ tournamentId: 't1' }] },
      { providerId: '__local__', calendar: [{ tournamentId: 't2' }] },
      { providerId: 'p9' }, // no calendar array — tolerated
    ]);
    const entries = await readLocalCalendarEntries();
    expect(h.upsertCalendarEntry).toHaveBeenCalledTimes(2); // one per migrated record
    expect(entries.map((e: any) => e.tournamentId).sort()).toEqual(['t1', 't2']);
    expect(localStorage.getItem('tmx_local_calendar_migrated')).toBe('1');
  });

  it('skips the full-record migration once flagged (no full-load)', async () => {
    localStorage.setItem('tmx_local_calendar_migrated', '1');
    h.findAllProviders.mockResolvedValue([{ providerId: 'p1', calendar: [{ tournamentId: 't1' }] }]);
    const entries = await readLocalCalendarEntries();
    expect(h.findAllTournaments).not.toHaveBeenCalled();
    expect(entries).toHaveLength(1);
  });
});

describe('resetLocalCalendar (privacy clear on logout/login)', () => {
  it('clears provider calendars and the migration flag so entries re-derive', async () => {
    localStorage.setItem('tmx_local_calendar_migrated', '1');
    await resetLocalCalendar();
    expect(h.clearAllProviderCalendars).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('tmx_local_calendar_migrated')).toBeNull();
  });
});
