import { describe, expect, it } from 'vitest';

import { decideActiveScaleSwitch } from './decideActiveScaleSwitch';

describe('decideActiveScaleSwitch', () => {
  it('is a no-op when the tournament has no ratings at all', () => {
    const d = decideActiveScaleSwitch({ activeScale: 'wtn', availableScaleNames: [], alreadyAsked: false });
    expect(d.action).toBe('no-op');
  });

  it('is a no-op when the active scale is already present', () => {
    const d = decideActiveScaleSwitch({
      activeScale: 'wtn',
      availableScaleNames: ['WTN', 'UTR'],
      alreadyAsked: false,
    });
    expect(d.action).toBe('no-op');
  });

  it('switches silently when exactly one rating is present and it is not active', () => {
    const d = decideActiveScaleSwitch({ activeScale: 'wtn', availableScaleNames: ['UTR'], alreadyAsked: false });
    expect(d.action).toBe('switch');
    expect(d.toScale).toBe('utr');
  });

  it('switches silently regardless of prior prompt state when only one rating is present', () => {
    const d = decideActiveScaleSwitch({ activeScale: 'wtn', availableScaleNames: ['UTR'], alreadyAsked: true });
    expect(d.action).toBe('switch');
    expect(d.toScale).toBe('utr');
  });

  it('prompts when multiple ratings are present, none match, and not yet asked', () => {
    const d = decideActiveScaleSwitch({
      activeScale: 'ntrp',
      availableScaleNames: ['WTN', 'UTR'],
      alreadyAsked: false,
    });
    expect(d.action).toBe('prompt');
    expect(d.availableScales).toEqual(['wtn', 'utr']);
    expect(d.toScale).toBeUndefined();
  });

  it('does not re-prompt for a tournament that was already asked', () => {
    const d = decideActiveScaleSwitch({
      activeScale: 'ntrp',
      availableScaleNames: ['WTN', 'UTR'],
      alreadyAsked: true,
    });
    expect(d.action).toBe('no-op');
  });

  it('is case-insensitive on the active scale', () => {
    const d = decideActiveScaleSwitch({ activeScale: 'WTN', availableScaleNames: ['wtn'], alreadyAsked: false });
    expect(d.action).toBe('no-op');
  });

  it('normalizes available scales to lowercase in the result', () => {
    const d = decideActiveScaleSwitch({ activeScale: 'ntrp', availableScaleNames: ['UTR'], alreadyAsked: false });
    expect(d.toScale).toBe('utr');
    expect(d.availableScales).toEqual(['utr']);
  });

  it('tolerates an empty active scale string by treating it as not-present', () => {
    const d = decideActiveScaleSwitch({ activeScale: '', availableScaleNames: ['WTN'], alreadyAsked: false });
    expect(d.action).toBe('switch');
    expect(d.toScale).toBe('wtn');
  });
});
