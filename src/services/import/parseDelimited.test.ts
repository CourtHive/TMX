import { detectDelimiter, parseDelimited } from './parseDelimited';
import { describe, expect, it } from 'vitest';

describe('detectDelimiter', () => {
  it('returns "," when commas dominate the first line', () => {
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
  });

  it('returns "\\t" when tabs dominate the first line', () => {
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
  });

  it('ignores delimiters inside quoted fields', () => {
    expect(detectDelimiter('"a,b,c,d",1,2\n')).toBe(',');
    expect(detectDelimiter('"a\tb\tc",1,2\n')).toBe(',');
  });

  it('handles escaped quotes inside quoted fields', () => {
    expect(detectDelimiter('"a""b",c,d\n')).toBe(',');
  });

  it('defaults to comma when neither delimiter is found', () => {
    expect(detectDelimiter('singlecolumn\nvalue')).toBe(',');
  });
});

describe('parseDelimited', () => {
  it('parses a basic comma-separated input', () => {
    const result = parseDelimited('first,last,sex\nJohn,Smith,M\nJane,Doe,F');
    expect(result.delimiter).toBe(',');
    expect(result.headers).toEqual(['first', 'last', 'sex']);
    expect(result.rows).toEqual([
      ['John', 'Smith', 'M'],
      ['Jane', 'Doe', 'F'],
    ]);
  });

  it('parses a tab-separated input', () => {
    const result = parseDelimited('first\tlast\tsex\nJohn\tSmith\tM');
    expect(result.delimiter).toBe('\t');
    expect(result.headers).toEqual(['first', 'last', 'sex']);
    expect(result.rows).toEqual([['John', 'Smith', 'M']]);
  });

  it('preserves duplicate headers', () => {
    const result = parseDelimited('Name,Email,Name,Email\nA,a@x,B,b@x');
    expect(result.headers).toEqual(['Name', 'Email', 'Name', 'Email']);
    expect(result.rows).toEqual([['A', 'a@x', 'B', 'b@x']]);
  });

  it('handles quoted fields containing the delimiter', () => {
    const result = parseDelimited('city,note\n"Boston, MA","hello, world"');
    expect(result.rows).toEqual([['Boston, MA', 'hello, world']]);
  });

  it('handles quoted fields containing embedded newlines', () => {
    const result = parseDelimited('a,b\n"line1\nline2",ok');
    expect(result.rows).toEqual([['line1\nline2', 'ok']]);
  });

  it('handles doubled quotes as escape', () => {
    const result = parseDelimited('a,b\n"He said ""hi""",ok');
    expect(result.rows).toEqual([['He said "hi"', 'ok']]);
  });

  it('handles CRLF line endings', () => {
    const result = parseDelimited('a,b\r\n1,2\r\n3,4\r\n');
    expect(result.headers).toEqual(['a', 'b']);
    expect(result.rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('skips fully blank lines', () => {
    const result = parseDelimited('a,b\n\n1,2\n\n');
    expect(result.rows).toEqual([['1', '2']]);
  });

  it('preserves empty trailing fields', () => {
    const result = parseDelimited('a,b,c\n1,,3');
    expect(result.rows).toEqual([['1', '', '3']]);
  });

  it('returns empty headers and rows for empty input', () => {
    const result = parseDelimited('');
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it('returns headers but no rows for header-only input', () => {
    const result = parseDelimited('a,b,c\n');
    expect(result.headers).toEqual(['a', 'b', 'c']);
    expect(result.rows).toEqual([]);
  });

  it('trims whitespace in headers', () => {
    const result = parseDelimited(' first , last \n1,2');
    expect(result.headers).toEqual(['first', 'last']);
  });

  it('respects an explicit delimiter override', () => {
    // Force comma even though tabs dominate
    const result = parseDelimited('a\tb,c\n1\t2,3', { delimiter: ',' });
    expect(result.delimiter).toBe(',');
    expect(result.headers).toEqual(['a\tb', 'c']);
    expect(result.rows).toEqual([['1\t2', '3']]);
  });
});
