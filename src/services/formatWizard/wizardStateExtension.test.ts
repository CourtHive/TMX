import { describe, expect, it, vi, beforeEach } from 'vitest';

// constants and types
import { FORMAT_WIZARD_EXTENSION_NAME } from './wizardStateExtension';

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

import { readWizardState, writeWizardState, PersistedWizardState } from './wizardStateExtension';

const validState: PersistedWizardState = {
  scaleName: 'utr',
  constraints: {
    courts: 4,
    days: 2,
    hoursPerDay: 8,
    minMatchesFloor: 3,
    targetCompetitivePct: 0.65,
    consolationAppetite: 'LIGHT',
  },
};

describe('readWizardState', () => {
  beforeEach(() => {
    getTournamentMock.mockReset();
  });

  it('returns undefined when there is no tournament record', () => {
    getTournamentMock.mockReturnValue(undefined);
    expect(readWizardState()).toBeUndefined();
  });

  it('returns undefined when the tournament has no extensions', () => {
    getTournamentMock.mockReturnValue({ tournamentRecord: {} });
    expect(readWizardState()).toBeUndefined();
  });

  it('returns undefined when the formatWizard extension is missing', () => {
    getTournamentMock.mockReturnValue({
      tournamentRecord: { extensions: [{ name: 'somethingElse', value: { courts: 4 } }] },
    });
    expect(readWizardState()).toBeUndefined();
  });

  it('returns the parsed state when the extension shape is valid', () => {
    getTournamentMock.mockReturnValue({
      tournamentRecord: {
        extensions: [{ name: FORMAT_WIZARD_EXTENSION_NAME, value: validState }],
      },
    });
    const state = readWizardState();
    expect(state?.scaleName).toEqual('utr');
    expect(state?.constraints.courts).toEqual(4);
    expect(state?.constraints.consolationAppetite).toEqual('LIGHT');
  });

  it('returns undefined when courts/days are missing or non-numeric', () => {
    getTournamentMock.mockReturnValue({
      tournamentRecord: {
        extensions: [{ name: FORMAT_WIZARD_EXTENSION_NAME, value: { scaleName: 'utr', constraints: { courts: 'four' } } }],
      },
    });
    expect(readWizardState()).toBeUndefined();
  });

  it('strips invalid optional fields rather than rejecting the whole state', () => {
    getTournamentMock.mockReturnValue({
      tournamentRecord: {
        extensions: [
          {
            name: FORMAT_WIZARD_EXTENSION_NAME,
            value: {
              scaleName: 'utr',
              constraints: { courts: 4, days: 2, consolationAppetite: 'OVERKILL' },
            },
          },
        ],
      },
    });
    const state = readWizardState();
    expect(state?.constraints.courts).toEqual(4);
    expect(state?.constraints.consolationAppetite).toBeUndefined();
  });
});

describe('writeWizardState', () => {
  beforeEach(() => {
    mutationRequestMock.mockReset();
  });

  it('issues an ADD_TOURNAMENT_EXTENSION mutation with the formatWizard payload', () => {
    writeWizardState(validState);
    expect(mutationRequestMock).toHaveBeenCalledTimes(1);
    const call = mutationRequestMock.mock.calls[0][0];
    expect(call.methods).toHaveLength(1);
    expect(call.methods[0].method).toEqual('addTournamentExtension');
    expect(call.methods[0].params.extension.name).toEqual(FORMAT_WIZARD_EXTENSION_NAME);
    expect(call.methods[0].params.extension.value.scaleName).toEqual('utr');
    expect(call.methods[0].params.extension.value.updatedAt).toBeDefined();
  });
});
