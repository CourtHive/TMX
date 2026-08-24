/**
 * Eligibility verdicts and the merge with conflicts.
 *
 * **The case that matters is `unknown` vs `none`.** "We could not check" and "we checked and found
 * nothing" are different facts, and collapsing them into one pixel is the failure the fail-soft rule
 * exists to prevent. Every test here that asserts `none` has a sibling asserting `unknown`, because
 * an implementation that returned `none` everywhere would otherwise pass half this suite.
 */
import { evaluateEligibility, mergeVerdicts } from './officialEligibility';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// The module imports `tournamentEngine` as a binding, so spying on a separately-required copy does
// not affect it — module-level mock is the only thing that reaches the call site.
const getOfficialEligibility = vi.fn();
vi.mock('tods-competition-factory', () => ({
  tournamentEngine: {
    getOfficialEligibility: (...args: any[]) => getOfficialEligibility(...args),
  },
}));

const RECORD = { personId: 'p1', certifications: [] };

beforeEach(() => getOfficialEligibility.mockReset());

describe('evaluateEligibility', () => {
  it('contributes NOTHING when the registry is unreachable or configured for nobody', () => {
    // The majority case: most tournaments run no AMS registry, and that is legitimate. Returning
    // `unknown` here would annotate every candidate at every such tournament and bury the COI
    // signal, which IS checkable locally. Journey 94 caught exactly this.
    expect(evaluateEligibility({ recordsById: undefined, personId: 'p1' })).toBeUndefined();
    expect(evaluateEligibility({ recordsById: {}, personId: 'p1' })).toBeUndefined();
  });

  it('is unknown when the registry IS in use but holds no record for this person', () => {
    // The registry answered for somebody else, so this person genuinely was not checked.
    expect(evaluateEligibility({ recordsById: { other: RECORD }, personId: 'p1' })?.level).toBe('unknown');
  });

  it('is none when the factory says eligible', () => {
    getOfficialEligibility.mockReturnValue({ eligible: true });
    expect(evaluateEligibility({ recordsById: { p1: RECORD }, personId: 'p1' })?.level).toBe('none');
  });

  it('BLOCKS when the factory says ineligible, and carries the reasons', () => {
    // Not a warn: an expired certification or an active suspension is not a referee's to waive,
    // unlike a conflict of interest.
    getOfficialEligibility.mockReturnValue({ eligible: false, reasons: ['certification expired'] });
    const verdict = evaluateEligibility({ recordsById: { p1: RECORD }, personId: 'p1' });
    expect(verdict?.level).toBe('blocked');
    expect(verdict?.reasons).toEqual(['certification expired']);
  });

  it('is unknown when the factory errors, never none', () => {
    getOfficialEligibility.mockReturnValue({ error: { message: 'MISSING_OFFICIAL_RECORD' } });
    expect(evaluateEligibility({ recordsById: { p1: RECORD }, personId: 'p1' })?.level).toBe('unknown');
  });
});

describe('mergeVerdicts', () => {
  it('takes the worst level', () => {
    expect(mergeVerdicts({ level: 'none', reasons: [] }, { level: 'blocked', reasons: [] }).level).toBe('blocked');
    expect(mergeVerdicts({ level: 'none', reasons: [] }, { level: 'warn', reasons: [] }).level).toBe('warn');
  });

  it('ranks unknown ABOVE none — not-checked must not read as clean', () => {
    // The load-bearing ordering. A clean COI check must not mask an unchecked certification.
    expect(mergeVerdicts({ level: 'none', reasons: [] }, { level: 'unknown', reasons: [] }).level).toBe('unknown');
  });

  it('lets a real finding outrank unknown', () => {
    expect(mergeVerdicts({ level: 'unknown', reasons: [] }, { level: 'warn', reasons: [] }).level).toBe('warn');
  });

  it('accumulates every reason, not just the first', () => {
    // A picker showing one reason teaches operators that clearing one issue clears the row.
    const merged = mergeVerdicts(
      { level: 'warn', reasons: ['shared group'] },
      { level: 'blocked', reasons: ['suspended'] },
    );
    expect(merged.reasons).toEqual(['shared group', 'suspended']);
  });

  it('is unknown when given nothing', () => {
    expect(mergeVerdicts(undefined, undefined).level).toBe('unknown');
  });
});
