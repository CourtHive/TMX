import { makeTimingResolver } from './scheduleTimingResolver';
import { tournamentEngine } from 'services/factory/engine';
import { beforeEach, describe, expect, it } from 'vitest';
import { mocksEngine } from 'tods-competition-factory';

// constants and types
import type { ReadinessMatchUp } from './matchUpReadiness';

const FORMAT = 'SET3-S:6/TB7';

/**
 * The bug this file exists to hold closed: recovery is category-dependent.
 * `POLICY_SCHEDULING_DEFAULT` gives ADULT doubles 30 minutes and JUNIOR doubles
 * 60, and `getScheduleTiming` reads the category off `event.category`. The
 * Inspector previously passed only `{ matchUpFormat, eventType }`, so junior
 * doubles silently resolved to the adult figure.
 */
function seedEvent(categoryType?: string) {
  const eventProfiles = [
    {
      eventName: 'Doubles',
      eventType: 'DOUBLES',
      drawProfiles: [{ drawSize: 4, matchUpFormat: FORMAT }],
      ...(categoryType && { category: { categoryType } }),
    },
  ];
  mocksEngine.generateTournamentRecord({ eventProfiles, setState: true });
  const { matchUps }: any = tournamentEngine.allTournamentMatchUps({ inContext: true });
  return matchUps[0] as ReadinessMatchUp;
}

describe('makeTimingResolver — category-aware recovery', () => {
  beforeEach(() => {
    tournamentEngine.reset?.();
  });

  it('resolves ADULT doubles recovery from the default scheduling policy', () => {
    const matchUp = seedEvent('ADULT');
    expect(makeTimingResolver()(matchUp).recoveryMinutes).toBe(30);
  });

  it('resolves JUNIOR doubles recovery to the LONGER figure the policy specifies', () => {
    const matchUp = seedEvent('JUNIOR');
    expect(makeTimingResolver()(matchUp).recoveryMinutes).toBe(60);
  });

  it('carries typeChangeRecoveryMinutes, which the readiness section never resolved', () => {
    const matchUp = seedEvent('ADULT');
    expect(makeTimingResolver()(matchUp).typeChangeRecoveryMinutes).toBeGreaterThan(0);
  });

  it('memoises per format + type + event so repeated lookups stay cheap', () => {
    const matchUp = seedEvent('JUNIOR');
    const resolver = makeTimingResolver();
    expect(resolver(matchUp)).toBe(resolver(matchUp));
  });

  it('falls back to a flat 90/0 for a matchUp carrying no format', () => {
    seedEvent('ADULT');
    const timing = makeTimingResolver()({ matchUpId: 'x' });
    expect(timing).toMatchObject({ averageMinutes: 90, recoveryMinutes: 0 });
  });
});
