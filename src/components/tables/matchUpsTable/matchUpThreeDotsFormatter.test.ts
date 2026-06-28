import { pickThreeDotsClassName } from './matchUpThreeDotsFormatter';
import { describe, expect, it } from 'vitest';

const BASE = 'fa fa-ellipsis-vertical';
const GLOW = `${BASE} three-dot-glow`;

describe('pickThreeDotsClassName', () => {
  it('returns the base icon when no matchUpId is provided', () => {
    expect(pickThreeDotsClassName(undefined, () => true)).toBe(BASE);
  });

  it('returns the base icon when there is no activity for the matchUp', () => {
    expect(pickThreeDotsClassName('mu-A', () => false)).toBe(BASE);
  });

  it('adds the glow class when the matchUp has activity', () => {
    expect(pickThreeDotsClassName('mu-A', (id) => id === 'mu-A')).toBe(GLOW);
  });

  it('does not glow when activity is reported for a different matchUp', () => {
    expect(pickThreeDotsClassName('mu-A', (id) => id === 'mu-B')).toBe(BASE);
  });
});
