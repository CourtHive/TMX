import { describe, expect, it } from 'vitest';

import { isSchedulingAmbiguity } from './isSchedulingAmbiguity';

const AMBIGUOUS = { code: 'ERR_MATCHUP_HAS_SCHEDULING' };
const OTHER = { code: 'ERR_DRAW_POSITION_ACTIVE' };

describe('isSchedulingAmbiguity', () => {
  it('recognises the engine asking which way to go, at the top level', () => {
    expect(isSchedulingAmbiguity({ success: false, error: AMBIGUOUS })).toBe(true);
  });

  it('recognises it inside a per-method executionQueue result', () => {
    expect(isSchedulingAmbiguity({ success: false, results: [{ error: AMBIGUOUS }] })).toBe(true);
  });

  it('does NOT swallow other failures — they must keep surfacing as errors', () => {
    // Falsifies the cases above: a predicate that just returned `!result.success`
    // would satisfy them and would silently turn every failed BYE assignment into
    // a "keep or remove scheduling?" prompt.
    expect(isSchedulingAmbiguity({ success: false, error: OTHER })).toBe(false);
    expect(isSchedulingAmbiguity({ success: false, results: [{ error: OTHER }] })).toBe(false);
    expect(isSchedulingAmbiguity({ success: false })).toBe(false);
  });

  it('never prompts on success', () => {
    expect(isSchedulingAmbiguity({ success: true })).toBe(false);
    // Defensive: a success carrying a stale error field is still a success.
    expect(isSchedulingAmbiguity({ success: true, error: AMBIGUOUS })).toBe(false);
  });

  it('tolerates a missing result', () => {
    expect(isSchedulingAmbiguity(undefined)).toBe(false);
    expect(isSchedulingAmbiguity(null)).toBe(false);
  });
});
