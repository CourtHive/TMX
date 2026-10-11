/**
 * The format picker shows only the words TMX passes it (courthive-components 6.5.0 reads every label
 * from `config.labels`). Each must resolve to text in en.json: a missing key would reach the picker as
 * its own key path. A label that carries a number is a template whose `{n}` the picker fills; single
 * braces, so i18next passes it through untouched.
 */
import { getMatchFormatLabels } from './matchFormatLabels';
import { describe, expect, it } from 'vitest';

function leaves(value: unknown, path = ''): [string, unknown][] {
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, inner]) => leaves(inner, path ? `${path}.${key}` : key));
  }
  return [[path, value]];
}

const TEMPLATES = ['setTo', 'tiebreakTo', 'winBy', 'minutes', 'outs', 'maxMinutes', 'pointsTotal', 'consecutive'];

describe('the labels TMX passes to the format picker', () => {
  const labels = getMatchFormatLabels() as Record<string, any>;

  it('every one resolves to text, none to a missing key', () => {
    const all = leaves(labels);
    expect(all.length, 'control: the labels were read').toBeGreaterThan(50);
    const unresolved = all.filter(([, value]) => typeof value !== 'string' || !value || value.startsWith('modals.'));
    expect(unresolved).toEqual([]);
  });

  it('every template keeps its {n}, and i18next has not interpolated it', () => {
    for (const key of TEMPLATES) expect(labels[key], key).toContain('{n}');
    expect(labels.setTo).toBe('to {n}');
  });

  it('singular and plural set-type names are both passed', () => {
    expect(labels.what.sets).toBe('Set');
    expect(labels.whatPlural.sets).toBe('Sets');
    expect(Object.keys(labels.whatPlural).sort((a, b) => a.localeCompare(b))).toEqual(
      Object.keys(labels.what).sort((a, b) => a.localeCompare(b)),
    );
  });

  it('every match root has a name', () => {
    expect(Object.keys(labels.matchRoots)).toEqual(['SET', 'HAL', 'QTR', 'PER', 'INN', 'RND', 'FRM', 'MAP']);
  });
});
