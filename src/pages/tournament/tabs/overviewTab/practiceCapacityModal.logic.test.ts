import { describe, expect, it } from 'vitest';

import { parseCapacityInput, resolveFromRecord } from './practiceCapacityModal.logic';

describe('resolveFromRecord', () => {
  it('returns null for a record with no scheduling.practice', () => {
    expect(resolveFromRecord({})).toBeNull();
    expect(resolveFromRecord({ scheduling: {} })).toBeNull();
    expect(resolveFromRecord({ scheduling: { practice: {} } })).toBeNull();
  });

  it('returns null when defaultCapacity is explicitly null', () => {
    expect(resolveFromRecord({ scheduling: { practice: { defaultCapacity: null } } })).toBeNull();
  });

  it('returns the numeric value when set', () => {
    expect(resolveFromRecord({ scheduling: { practice: { defaultCapacity: 4 } } })).toBe(4);
    expect(resolveFromRecord({ scheduling: { practice: { defaultCapacity: 0 } } })).toBe(0);
  });

  it('returns null for an absent record', () => {
    expect(resolveFromRecord(undefined)).toBeNull();
    expect(resolveFromRecord(null)).toBeNull();
  });
});

describe('parseCapacityInput', () => {
  it('returns null for unlimited mode regardless of capValue', () => {
    expect(parseCapacityInput({ mode: 'unlimited', capValue: '4' })).toEqual({ ok: true, value: null });
    expect(parseCapacityInput({ mode: 'unlimited', capValue: '' })).toEqual({ ok: true, value: null });
    expect(parseCapacityInput({ mode: 'unlimited', capValue: 'garbage' })).toEqual({ ok: true, value: null });
  });

  it('returns the parsed integer for capped mode', () => {
    expect(parseCapacityInput({ mode: 'capped', capValue: '4' })).toEqual({ ok: true, value: 4 });
    expect(parseCapacityInput({ mode: 'capped', capValue: '0' })).toEqual({ ok: true, value: 0 });
  });

  it('trims whitespace before parsing', () => {
    expect(parseCapacityInput({ mode: 'capped', capValue: '  4  ' })).toEqual({ ok: true, value: 4 });
  });

  it('rejects empty input in capped mode', () => {
    const r = parseCapacityInput({ mode: 'capped', capValue: '' });
    expect(r.ok).toBe(false);
  });

  it('rejects non-integer input', () => {
    const r1 = parseCapacityInput({ mode: 'capped', capValue: '1.5' });
    expect(r1.ok).toBe(false);
    const r2 = parseCapacityInput({ mode: 'capped', capValue: 'abc' });
    expect(r2.ok).toBe(false);
  });

  it('rejects negative integers', () => {
    const r = parseCapacityInput({ mode: 'capped', capValue: '-1' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorKey).toContain('mustBeNonNegative');
  });
});
