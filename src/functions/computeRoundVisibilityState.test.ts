import { describe, expect, it } from 'vitest';
import { computeRoundVisibilityState } from './computeRoundVisibilityState';

const futureDate = new Date(Date.now() + 60_000).toISOString();
const pastDate = new Date(Date.now() - 60_000).toISOString();

const makeMatchUps = (...roundNumbers: number[]) => roundNumbers.map((rn) => ({ roundNumber: rn }));

describe('computeRoundVisibilityState', () => {
  it('returns undefined when structureDetail is falsy', () => {
    let result: any = computeRoundVisibilityState(undefined, makeMatchUps(1, 2));
    expect(result).toBeUndefined();
  });

  it('returns undefined when no matchUps', () => {
    let result: any = computeRoundVisibilityState({ roundLimit: 1 }, []);
    expect(result).toBeUndefined();
  });

  it('returns undefined when maxRound is 0', () => {
    let result: any = computeRoundVisibilityState({ roundLimit: 1 }, [{ roundNumber: 0 }]);
    expect(result).toBeUndefined();
  });

  it('marks rounds beyond roundLimit as hidden', () => {
    let result: any = computeRoundVisibilityState({ roundLimit: 2 }, makeMatchUps(1, 2, 3, 4));
    expect(result[1]).toBeUndefined();
    expect(result[2]).toBeUndefined();
    expect(result[3]).toEqual({ hidden: true });
    expect(result[4]).toEqual({ hidden: true });
  });

  it('returns undefined when all rounds are within limit', () => {
    let result: any = computeRoundVisibilityState({ roundLimit: 4 }, makeMatchUps(1, 2, 3));
    expect(result).toBeUndefined();
  });

  it('marks rounds with active embargo as embargoed', () => {
    let result: any = computeRoundVisibilityState(
      { scheduledRounds: { 2: { embargo: futureDate } } },
      makeMatchUps(1, 2, 3),
    );
    expect(result[1]).toBeUndefined();
    expect(result[2]).toEqual({ embargoed: true });
    expect(result[3]).toBeUndefined();
  });

  it('ignores expired embargoes', () => {
    let result: any = computeRoundVisibilityState(
      { scheduledRounds: { 2: { embargo: pastDate } } },
      makeMatchUps(1, 2),
    );
    expect(result).toBeUndefined();
  });

  it('combines hidden and embargoed on the same round', () => {
    let result: any = computeRoundVisibilityState(
      { roundLimit: 1, scheduledRounds: { 2: { embargo: futureDate } } },
      makeMatchUps(1, 2),
    );
    expect(result[2]).toEqual({ hidden: true, embargoed: true });
  });

  it('returns undefined when no visibility state is produced', () => {
    let result: any = computeRoundVisibilityState({}, makeMatchUps(1, 2));
    expect(result).toBeUndefined();
  });
});
