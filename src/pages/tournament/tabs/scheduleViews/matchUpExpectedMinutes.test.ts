import { competitionEngine, tournamentEngine } from 'services/factory/engine';
import { expectedAverageMinutes, resolveMatchUpFormat } from './matchUpExpectedMinutes';
import { beforeEach, describe, expect, it } from 'vitest';
import { mocksEngine } from 'tods-competition-factory';

const FORMAT = 'SET3-S:6/TB7';
const POLICY_AVERAGE = 90;

/**
 * Two events on the same format, each with a category: the override written for one must change
 * that event's matchUps and leave the other's on the scheduling policy's figure.
 */
function seed() {
  const eventProfiles = ['U18', 'U16'].map((categoryName) => ({
    eventName: categoryName,
    category: { categoryName, categoryType: 'JUNIOR' } as any,
    drawProfiles: [{ drawSize: 4, matchUpFormat: FORMAT }],
  }));
  const { eventIds }: any = mocksEngine.generateTournamentRecord({ eventProfiles, setState: true });
  const { matchUps }: any = tournamentEngine.allTournamentMatchUps({ inContext: true });
  const firstOf = (eventId: string) => matchUps.find((matchUp: any) => matchUp.eventId === eventId);
  return { eventIds, overridden: firstOf(eventIds[0]), other: firstOf(eventIds[1]) };
}

function overrideTiming(eventId: string) {
  const result: any = tournamentEngine.executionQueue([
    {
      method: 'modifyEventMatchUpFormatTiming',
      params: { eventId, matchUpFormat: FORMAT, averageMinutes: 75, recoveryMinutes: 30 },
    },
  ]);
  expect(result.success).toBe(true);
}

describe('expectedAverageMinutes', () => {
  beforeEach(() => {
    tournamentEngine.reset?.();
  });

  it('reads the policy average when no event has its own timing', () => {
    const { overridden } = seed();
    expect(expectedAverageMinutes(overridden)).toBe(POLICY_AVERAGE);
  });

  it("reads the matchUp's event timing once the event overrides it", () => {
    const { eventIds, overridden } = seed();
    overrideTiming(eventIds[0]);
    expect(expectedAverageMinutes(overridden)).toBe(75);
  });

  it("leaves another event's matchUps on the policy average", () => {
    const { eventIds, other } = seed();
    overrideTiming(eventIds[0]);
    expect(expectedAverageMinutes(other)).toBe(POLICY_AVERAGE);
  });

  it('finds the event from the draw when the matchUp carries only a drawId', () => {
    const { eventIds, overridden } = seed();
    overrideTiming(eventIds[0]);
    expect(expectedAverageMinutes({ drawId: overridden.drawId, matchUpType: overridden.matchUpType })).toBe(75);
  });

  it('returns undefined when no format can be resolved', () => {
    seed();
    expect(expectedAverageMinutes({ matchUpType: 'SINGLES' })).toBeUndefined();
    expect(expectedAverageMinutes(undefined)).toBeUndefined();
  });
});

describe('the engine read behind it', () => {
  beforeEach(() => {
    tournamentEngine.reset?.();
  });

  it('resolves eventId to the event and returns its override, recovery included', () => {
    const { eventIds } = seed();
    overrideTiming(eventIds[0]);
    const withEvent: any = competitionEngine.getMatchUpFormatTiming({ matchUpFormat: FORMAT, eventId: eventIds[0] });
    expect([withEvent.averageMinutes, withEvent.recoveryMinutes]).toEqual([75, 30]);
    const withoutEvent: any = competitionEngine.getMatchUpFormatTiming({ matchUpFormat: FORMAT });
    expect(withoutEvent.averageMinutes).toBe(POLICY_AVERAGE);
  });
});

describe('resolveMatchUpFormat', () => {
  beforeEach(() => {
    tournamentEngine.reset?.();
  });

  it("uses the matchUp's own format, else its draw's", () => {
    const { overridden } = seed();
    expect(resolveMatchUpFormat({ matchUpFormat: 'SET1-S:6/TB7' })).toBe('SET1-S:6/TB7');
    expect(resolveMatchUpFormat({ drawId: overridden.drawId })).toBe(FORMAT);
    expect(resolveMatchUpFormat({ drawId: 'unknown' })).toBeUndefined();
  });
});
