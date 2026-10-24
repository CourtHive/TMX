import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ addTournament: vi.fn(), maintain: vi.fn(), saveLocal: false }));

vi.mock('./tmx2db', () => ({ tmx2db: { addTournament: (record: any) => h.addTournament(record) } }));
vi.mock('./localCalendar', () => ({ maintainLocalCalendarEntry: (record: any) => h.maintain(record) }));
vi.mock('config/serverConfig', () => ({ serverConfig: { get: () => ({ saveLocal: h.saveLocal }) } }));
vi.mock('config/debugConfig', () => ({ debugConfig: { get: () => ({}) } }));
vi.mock('services/factory/engine', () => ({ tournamentEngine: { q: { tournament: () => undefined } } }));

import { saveTournamentRecord } from './saveTournamentRecord';

const providerBound = (offline?: any) => ({
  tournamentId: 't1',
  parentOrganisation: { organisationId: 'p1' },
  timeItems: offline ? [{ itemType: 'TMX', itemValue: { offline } }] : [],
});

/**
 * "Go offline" saves the record, and every offline edit after it saves through `localSave(true)`; both
 * reach this function. It used to skip every provider-bound record unless "Save local copies" was on,
 * so a director who went offline without that setting kept their offline edits in memory alone.
 */
describe('saveTournamentRecord', () => {
  beforeEach(() => {
    h.addTournament.mockReset();
    h.maintain.mockReset();
    h.saveLocal = false;
  });

  it('always saves a record held offline: its local copy is the only one', async () => {
    await saveTournamentRecord({ tournamentRecord: providerBound({ email: 'a@example.com' }) });
    expect(h.addTournament).toHaveBeenCalledTimes(1);
    expect(h.maintain).toHaveBeenCalledTimes(1);
  });

  it('still skips a provider-bound cache copy when "Save local copies" is off', async () => {
    // The control: the server holds this one, and caching it is the setting's decision.
    await saveTournamentRecord({ tournamentRecord: providerBound() });
    expect(h.addTournament).not.toHaveBeenCalled();
  });

  it('saves the cache copy when "Save local copies" is on, and provider-less records always', async () => {
    h.saveLocal = true;
    await saveTournamentRecord({ tournamentRecord: providerBound() });
    h.saveLocal = false;
    await saveTournamentRecord({ tournamentRecord: { tournamentId: 'demo' } });
    expect(h.addTournament).toHaveBeenCalledTimes(2);
  });
});
