import { defaultDrawComposition, participantsHaveCountryCodes } from './defaultDrawComposition';
import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { displayConfig } from 'config/displayConfig';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('pages/templates/compositionBridge', () => ({ getUserCompositionsSync: () => [] }));
// the package touches the DOM on import: the presets this reads, in their shape (journey 198 draws the real ones)
vi.mock('courthive-components', () => ({
  compositions: {
    Basic: { theme: 'basic', configuration: { gameScoreOnly: true } },
    Scoreboard: {
      theme: 'basicCard',
      configuration: {
        flags: true,
        connectors: true,
        liveStatusPill: false,
        scheduleInfo: { elapsed: true, eventRound: true },
      },
    },
  },
}));

/**
 * The composition a structure is drawn with when nothing chose one (CA 2026-11-08): Scoreboard, with the schedule
 * and connectors on, and flags only when someone in the draw has a country code.
 */
function seed({ eventType, withCountryCodes }: { eventType?: string; withCountryCodes: boolean }) {
  const {
    tournamentRecord,
    drawIds: [drawId],
    eventIds: [eventId],
  } = mocksEngine.generateTournamentRecord({ drawProfiles: [{ drawSize: 8, eventType }] });
  if (!withCountryCodes) {
    for (const participant of tournamentRecord.participants ?? []) {
      if (participant.person) {
        delete participant.person.nationalityCode;
        delete (participant.person as any).iso2NationalityCode;
      }
    }
  }
  tournamentEngine.setState(tournamentRecord);
  return { drawId, eventId };
}

describe('defaultDrawComposition', () => {
  afterEach(() => displayConfig.reset());

  it('Scoreboard, schedule and connectors on, flags on when the draw has country codes', () => {
    const { drawId, eventId } = seed({ withCountryCodes: true });
    const { compositionName, composition } = defaultDrawComposition({ eventType: 'SINGLES', drawId, eventId });
    expect(compositionName).toEqual('Scoreboard');
    expect(composition.configuration.scheduleInfo).toBeTruthy();
    expect(composition.configuration.connectors).toBe(true);
    expect(composition.configuration.flags).toBe(true);
    expect(composition.configuration.liveStatusPill).toBe(true);
  });

  it('flags off when nobody in the draw has a country code', () => {
    const { drawId, eventId } = seed({ withCountryCodes: false });
    const { composition } = defaultDrawComposition({ eventType: 'SINGLES', drawId, eventId });
    expect(composition.configuration.flags).toBe(false);
  });

  it('a doubles draw reads its pairs’ members', () => {
    const { drawId, eventId } = seed({ eventType: 'DOUBLES', withCountryCodes: true });
    expect(defaultDrawComposition({ eventType: 'DOUBLES', drawId, eventId }).composition.configuration.flags).toBe(
      true,
    );
    const bare = seed({ eventType: 'DOUBLES', withCountryCodes: false });
    expect(defaultDrawComposition({ eventType: 'DOUBLES', ...bare }).composition.configuration.flags).toBe(false);
  });

  it('a configured default wins, unchanged; TEAM stays Basic', () => {
    const { drawId, eventId } = seed({ withCountryCodes: false });
    expect(defaultDrawComposition({ eventType: 'TEAM', drawId, eventId }).compositionName).toEqual('Basic');
    displayConfig.set({ composition: { compositionName: 'National', configuration: { flags: true } } });
    const { compositionName, composition } = defaultDrawComposition({ eventType: 'SINGLES', drawId, eventId });
    expect(compositionName).toEqual('National');
    expect(composition.configuration.flags).toBe(true);
  });

  it('a fresh copy every call: one caller’s changes never reach the next', () => {
    const { drawId, eventId } = seed({ withCountryCodes: true });
    defaultDrawComposition({ drawId, eventId }).composition.configuration.connectors = false;
    expect(defaultDrawComposition({ drawId, eventId }).composition.configuration.connectors).toBe(true);
  });
});

describe('participantsHaveCountryCodes', () => {
  it('reads a person, or a member of a pair or team', () => {
    expect(participantsHaveCountryCodes([])).toBe(false);
    expect(participantsHaveCountryCodes([{ person: {} }])).toBe(false);
    expect(participantsHaveCountryCodes([{ person: { nationalityCode: 'FRA' } }])).toBe(true);
    expect(
      participantsHaveCountryCodes([{ individualParticipants: [{ person: { iso2NationalityCode: 'FR' } }] }]),
    ).toBe(true);
  });
});
