import { describe, expect, it, vi, beforeEach } from 'vitest';

// constants and types
import { SCHEDULE_DISPLAY_EXTENSION_NAME } from './scheduleDisplayExtension';

const getTournamentMock = vi.fn();
const mutationRequestMock = vi.fn();

vi.mock('tods-competition-factory', async () => {
  const actual = await vi.importActual<any>('tods-competition-factory');
  return {
    ...actual,
    tournamentEngine: { getTournament: (...args: any[]) => getTournamentMock(...args) },
  };
});

vi.mock('services/mutation/mutationRequest', () => ({
  mutationRequest: (...args: any[]) => mutationRequestMock(...args),
}));

import { readScheduleDisplayConfig, writeScheduleDisplayConfig } from './scheduleDisplayExtension';

describe('readScheduleDisplayConfig', () => {
  beforeEach(() => {
    getTournamentMock.mockReset();
  });

  it('returns empty config when there is no tournament record', () => {
    getTournamentMock.mockReturnValue(undefined);
    expect(readScheduleDisplayConfig()).toEqual({});
  });

  it('returns empty config when the tournament has no extensions', () => {
    getTournamentMock.mockReturnValue({ tournamentRecord: {} });
    expect(readScheduleDisplayConfig()).toEqual({});
  });

  it('returns empty config when the scheduleDisplay extension is missing', () => {
    getTournamentMock.mockReturnValue({
      tournamentRecord: { extensions: [{ name: 'somethingElse', value: { minCourtGridRows: 20 } }] },
    });
    expect(readScheduleDisplayConfig()).toEqual({});
  });

  it('returns the minCourtGridRows when present and valid', () => {
    getTournamentMock.mockReturnValue({
      tournamentRecord: {
        extensions: [{ name: SCHEDULE_DISPLAY_EXTENSION_NAME, value: { minCourtGridRows: 18 } }],
      },
    });
    expect(readScheduleDisplayConfig()).toEqual({ minCourtGridRows: 18 });
  });

  it('floors fractional minCourtGridRows', () => {
    getTournamentMock.mockReturnValue({
      tournamentRecord: {
        extensions: [{ name: SCHEDULE_DISPLAY_EXTENSION_NAME, value: { minCourtGridRows: 12.7 } }],
      },
    });
    expect(readScheduleDisplayConfig()).toEqual({ minCourtGridRows: 12 });
  });

  it('rejects non-positive or non-finite minCourtGridRows', () => {
    getTournamentMock.mockReturnValue({
      tournamentRecord: {
        extensions: [{ name: SCHEDULE_DISPLAY_EXTENSION_NAME, value: { minCourtGridRows: 0 } }],
      },
    });
    expect(readScheduleDisplayConfig()).toEqual({});

    getTournamentMock.mockReturnValue({
      tournamentRecord: {
        extensions: [{ name: SCHEDULE_DISPLAY_EXTENSION_NAME, value: { minCourtGridRows: Number.NaN } }],
      },
    });
    expect(readScheduleDisplayConfig()).toEqual({});
  });

  it('rejects non-numeric minCourtGridRows', () => {
    getTournamentMock.mockReturnValue({
      tournamentRecord: {
        extensions: [{ name: SCHEDULE_DISPLAY_EXTENSION_NAME, value: { minCourtGridRows: '20' } }],
      },
    });
    expect(readScheduleDisplayConfig()).toEqual({});
  });
});

describe('writeScheduleDisplayConfig', () => {
  beforeEach(() => {
    mutationRequestMock.mockReset();
    getTournamentMock.mockReset();
  });

  it('issues an ADD_TOURNAMENT_EXTENSION mutation with the scheduleDisplay payload', () => {
    getTournamentMock.mockReturnValue({ tournamentRecord: {} });
    writeScheduleDisplayConfig({ minCourtGridRows: 24 });
    expect(mutationRequestMock).toHaveBeenCalledTimes(1);
    const call = mutationRequestMock.mock.calls[0][0];
    expect(call.methods).toHaveLength(1);
    expect(call.methods[0].method).toEqual('addTournamentExtension');
    expect(call.methods[0].params.extension.name).toEqual(SCHEDULE_DISPLAY_EXTENSION_NAME);
    expect(call.methods[0].params.extension.value.minCourtGridRows).toEqual(24);
  });

  it('preserves existing keys on partial update', () => {
    // Today the config only has one key, but the merge semantics mean future
    // additions (e.g. defaultStartTime, courtIdentifiers) will round-trip
    // when this caller only touches a subset.
    getTournamentMock.mockReturnValue({
      tournamentRecord: {
        extensions: [
          {
            name: SCHEDULE_DISPLAY_EXTENSION_NAME,
            value: { minCourtGridRows: 12, futureKey: 'preserved' as any },
          },
        ],
      },
    });
    writeScheduleDisplayConfig({ minCourtGridRows: 30 } as any);
    const call = mutationRequestMock.mock.calls[0][0];
    expect(call.methods[0].params.extension.value.minCourtGridRows).toEqual(30);
    expect(call.methods[0].params.extension.value.futureKey).toEqual('preserved');
  });
});
