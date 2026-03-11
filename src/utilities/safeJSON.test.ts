import { describe, expect, it, vi } from 'vitest';
import { parse, stringify } from './safeJSON';

describe('parse', () => {
  it('parses valid JSON', () => {
    expect(parse({ data: '{"a":1}' })).toEqual({ a: 1 });
    expect(parse({ data: '[1,2,3]' })).toEqual([1, 2, 3]);
    expect(parse({ data: '"hello"' })).toBe('hello');
    expect(parse({ data: '42' })).toBe(42);
    expect(parse({ data: 'true' })).toBe(true);
    expect(parse({ data: 'null' })).toBe(null);
  });

  it('returns undefined for invalid JSON', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(parse({ data: 'not json' })).toBeUndefined();
    expect(parse({ data: '{bad}' })).toBeUndefined();
    expect(parse({ data: '' })).toBeUndefined();
    vi.restoreAllMocks();
  });

  it('logs note on failure', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    parse({ note: 'test import', data: 'bad' });
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ note: 'test import' }),
    );
    vi.restoreAllMocks();
  });
});

describe('stringify', () => {
  it('stringifies objects and arrays', () => {
    expect(stringify({ a: 1 })).toBe('{"a":1}');
    expect(stringify([1, 2])).toBe('[1,2]');
  });

  it('returns undefined for falsy values', () => {
    expect(stringify(undefined)).toBeUndefined();
    expect(stringify(null)).toBeUndefined();
    expect(stringify(0)).toBeUndefined();
    expect(stringify('')).toBeUndefined();
  });

  it('returns string as-is', () => {
    expect(stringify('already a string')).toBe('already a string');
    expect(stringify('{"json":"like"}')).toBe('{"json":"like"}');
  });

  it('returns empty string for unstringifiable values', () => {
    const circular: any = {};
    circular.self = circular;
    expect(stringify(circular)).toBe('');
  });
});
