import { dedupeByEmail } from './dedupeByEmail';
import { describe, expect, it } from 'vitest';

describe('dedupeByEmail', () => {
  it('returns rows unchanged when no email column index is provided', () => {
    const rows = [
      ['John', 'a@x'],
      ['Jane', 'a@x'],
    ];
    const result = dedupeByEmail(rows, undefined);
    expect(result.mergedRows).toEqual(rows);
    expect(result.mergeCount).toBe(0);
  });

  it('keeps unique emails as separate rows', () => {
    const rows = [
      ['John', 'a@x'],
      ['Jane', 'b@x'],
    ];
    const result = dedupeByEmail(rows, 1);
    expect(result.mergedRows).toEqual(rows);
    expect(result.mergeCount).toBe(0);
  });

  it('merges rows with matching emails (case-insensitive, trimmed)', () => {
    const rows = [
      ['John', 'A@X.COM'],
      ['Johnny', '  a@x.com  '],
    ];
    const result = dedupeByEmail(rows, 1);
    // First-occurrence email cell value preserved (last non-empty wins),
    // and the name field uses the last non-empty value.
    expect(result.mergeCount).toBe(1);
    expect(result.mergedRows).toHaveLength(1);
    expect(result.mergedRows[0][0]).toBe('Johnny');
    expect(result.mergedRows[0][1]).toBe('  a@x.com  ');
  });

  it('uses last non-empty value per column (does not erase with later blanks)', () => {
    const rows = [
      ['John', 'a@x', '555-1111'],
      ['', 'a@x', ''],
      ['Johnny', 'a@x', ''],
    ];
    const result = dedupeByEmail(rows, 1);
    expect(result.mergedRows).toHaveLength(1);
    // name: 'Johnny' (last non-empty); phone: '555-1111' (preserved from row 0)
    expect(result.mergedRows[0]).toEqual(['Johnny', 'a@x', '555-1111']);
    expect(result.mergeCount).toBe(2);
  });

  it('preserves row order based on first occurrence of each email', () => {
    const rows = [
      ['John', 'a@x'],
      ['Jane', 'b@x'],
      ['Johnny', 'a@x'],
    ];
    const result = dedupeByEmail(rows, 1);
    expect(result.mergedRows).toHaveLength(2);
    expect(result.mergedRows[0][0]).toBe('Johnny'); // a@x — appeared first
    expect(result.mergedRows[1][0]).toBe('Jane');   // b@x — appeared second
    expect(result.mergeCount).toBe(1);
  });

  it('keeps blank-email rows as separate entries', () => {
    const rows = [
      ['Anon1', ''],
      ['Anon2', ''],
      ['John', 'a@x'],
    ];
    const result = dedupeByEmail(rows, 1);
    expect(result.mergedRows).toHaveLength(3);
    expect(result.mergeCount).toBe(0);
  });

  it('handles ragged rows (different lengths)', () => {
    const rows = [
      ['John', 'a@x', '555-1111'],
      ['Johnny', 'a@x'],
    ];
    const result = dedupeByEmail(rows, 1);
    expect(result.mergedRows).toHaveLength(1);
    expect(result.mergedRows[0]).toEqual(['Johnny', 'a@x', '555-1111']);
  });

  it('returns empty results for empty input', () => {
    const result = dedupeByEmail([], 0);
    expect(result.mergedRows).toEqual([]);
    expect(result.mergeCount).toBe(0);
  });
});
