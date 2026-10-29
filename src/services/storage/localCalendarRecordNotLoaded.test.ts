import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ upsertCalendarEntry: vi.fn() }));

vi.mock('./tmx2db', () => ({ tmx2db: { upsertCalendarEntry: h.upsertCalendarEntry } }));

import { maintainLocalCalendarEntry } from './localCalendar';

// Not mocked: the record saved need not be the one the engine holds, and its calendar entry is still written (an engine
// call works only on the records the engine holds, so this must not go through the engine).
describe('maintainLocalCalendarEntry with a record the engine does not hold', () => {
  it('writes the record’s calendar entry', async () => {
    const { tournamentRecord: loaded } = mocksEngine.generateTournamentRecord();
    tournamentEngine.setState(loaded);
    const { tournamentRecord: saved } = mocksEngine.generateTournamentRecord({ tournamentName: 'Not loaded' });

    await maintainLocalCalendarEntry(saved);

    expect(h.upsertCalendarEntry).toHaveBeenCalledTimes(1);
    const [, entry] = h.upsertCalendarEntry.mock.calls[0];
    expect(entry.tournamentId).toEqual(saved.tournamentId);
    expect(entry.tournamentId).not.toEqual(loaded.tournamentId);
  });
});
