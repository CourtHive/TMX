import { validateTournamentRecord } from 'services/validation/validateTournamentRecord';
import { defined } from 'functions/testing/defined';
import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { loadImportedTournament } from './loadImportedTournament';
import { describe, expect, it, vi } from 'vitest';

// The factory's module namespace is not configurable under ESM, so spying on the governor fails against a real
// install. Replace the governor with a copy whose getTournamentInconsistencies a test can override.
const inconsistencies = vi.hoisted(() => ({ override: undefined as undefined | ((...args: any[]) => any) }));
vi.mock('tods-competition-factory', async (importOriginal) => {
  const factory: any = await importOriginal();
  const governor = factory.tournamentGovernor;
  return {
    ...factory,
    tournamentGovernor: {
      ...governor,
      getTournamentInconsistencies: (...args: any[]) =>
        (inconsistencies.override ?? governor.getTournamentInconsistencies)(...args),
    },
  };
});

function mockJSON(mutate?: (record: any) => void): { data: string; tournamentId: string } {
  const { tournamentRecord } = mocksEngine.generateTournamentRecord({ drawProfiles: [{ drawSize: 4 }] });
  const record = structuredClone(tournamentRecord);
  mutate?.(record);
  return { data: JSON.stringify(record), tournamentId: record.tournamentId };
}

const STARTED = 'validation started';

describe('loadImportedTournament', () => {
  it('loads first and validates after, without waiting on validation', async () => {
    const order: string[] = [];
    let releaseValidation: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (releaseValidation = resolve));

    const { data, tournamentId } = mockJSON((record) => (record.events[0].eventType = 'NOT_AN_EVENT_TYPE'));
    const result = loadImportedTournament({
      data,
      onLoaded: () => order.push('loaded'),
      onValidated: () => order.push('validated'),
      // the real validator, held back until the load has returned
      validate: async (params) => {
        order.push(STARTED);
        await gate;
        return validateTournamentRecord(params);
      },
    });

    // the load returned synchronously, the record is in the engine, validation is still pending
    expect(order).toEqual(['loaded', STARTED]);
    expect(defined(tournamentEngine.getTournament().tournamentRecord, 'tournamentRecord').tournamentId).toEqual(
      tournamentId,
    );

    releaseValidation();
    const summary = await result.validation;
    expect(order).toEqual(['loaded', STARTED, 'validated']);
    // an invalid record still loaded; its findings arrive afterwards
    expect(summary?.findings.map((finding) => finding.path)).toContain('/events/0/eventType');
  });

  it('runs the real validator by default and reports nothing for a clean record', async () => {
    const validated: any[] = [];
    const { data } = mockJSON();
    const result = loadImportedTournament({ data, onLoaded: () => undefined, onValidated: (s) => validated.push(s) });
    const summary = await result.validation;
    expect(summary?.count).toEqual(0);
    expect(validated).toHaveLength(1);
  });

  it('never validates what it did not load', () => {
    let validated = false;
    const validate = async () => {
      validated = true;
      return undefined as any;
    };
    expect(loadImportedTournament({ data: '{not json', onLoaded: () => undefined, validate }).error).toBeDefined();
    expect(
      loadImportedTournament({ data: '{"tuid":"x","start":1}', onLoaded: () => undefined, validate }).classic,
    ).toEqual(true);
    expect(validated).toEqual(false);
  });

  it('still loads when the integrity check throws, and reports the check as unavailable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    inconsistencies.override = () => {
      throw new Error('engine exploded');
    };
    try {
      const loaded: any[] = [];
      const { data, tournamentId } = mockJSON();
      const result = loadImportedTournament({ data, onLoaded: (record) => loaded.push(record) });

      expect(result.error).toBeUndefined();
      expect(loaded).toHaveLength(1);
      expect(defined(tournamentEngine.getTournament().tournamentRecord, 'tournamentRecord').tournamentId).toEqual(
        tournamentId,
      );

      const summary = await result.validation;
      expect(summary?.count).toEqual(0);
      expect(summary?.integrityUnavailable).toEqual(true);
      expect(summary?.integrityUnavailableReason).toEqual('engine exploded');
    } finally {
      inconsistencies.override = undefined;
      warn.mockRestore();
    }
  });
});
