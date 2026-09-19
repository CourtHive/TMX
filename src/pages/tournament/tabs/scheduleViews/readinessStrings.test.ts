import { describe, expect, it } from 'vitest';
import en from 'i18n/locales/en.json';

/**
 * The readiness panel had TWO strings under one key.
 *
 * `schedule.inspector.readiness.ready` was both the all-clear sentence and the dependency-row
 * fragment `ready ~{{time}}`. `JSON.parse` keeps the LAST duplicate, so the fragment won, and the
 * all-clear line rendered a literal `{{time}}` to operators — its call site passes no `time`,
 * because the sentence it meant to render never had one.
 *
 * Nothing caught it: key-parity compares PARSED objects, so both sides already agreed, and the
 * hardcoded-string ratchet only reads source. `scripts/i18n-audit.mjs` now fails on a duplicate key
 * before it gets that far; this asserts the two strings stay distinguishable in meaning as well as
 * in name.
 */
describe('readiness i18n strings', () => {
  const readiness = (en as any).schedule.inspector.readiness;

  it('keeps the all-clear sentence free of interpolation', () => {
    // the call site renders this with NO values, so any placeholder reaches the operator raw
    expect(readiness.ready).toBeTruthy();
    expect(readiness.ready).not.toMatch(/\{\{/);
  });

  it('keeps the dependency fragments under their own keys', () => {
    expect(readiness.readyAt).toEqual(expect.stringContaining('{{time}}'));
    expect(readiness.finishes).toEqual(expect.stringContaining('{{time}}'));
  });

  it('does not let the all-clear and the fragment collapse back into one string', () => {
    expect(readiness.ready).not.toEqual(readiness.readyAt);
  });
});
