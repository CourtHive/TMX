import {
  applyGridSearch,
  gridSearchAvailable,
  registerGridSearchControl,
  resetGridSearchControl,
} from './gridSearchControl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The module reads exactly one property off the input, so a stub carrying it is
// the whole DOM surface — which is what lets this run in the node suite.
const fakeInput = (isConnected = true): any => ({ isConnected });

const LIVSON = 'Michael Livson';

beforeEach(() => resetGridSearchControl());

describe('gridSearchControl', () => {
  it('reports unavailable before anything registers', () => {
    expect(gridSearchAvailable()).toBe(false);
    expect(applyGridSearch(LIVSON)).toBe(false);
  });

  it('drives the registered setter', () => {
    const setText = vi.fn();
    registerGridSearchControl({ input: fakeInput(), setText });

    expect(applyGridSearch(LIVSON)).toBe(true);
    expect(setText).toHaveBeenCalledWith(LIVSON);
  });

  it('drops a registration whose input has left the document', () => {
    // The schedule tab rebuilds its header on every render and navigating away
    // never unregisters, so a stale control is the ordinary end state — it must
    // report unavailable rather than write into a detached input.
    const setText = vi.fn();
    registerGridSearchControl({ input: fakeInput(false), setText });

    expect(gridSearchAvailable()).toBe(false);
    expect(applyGridSearch(LIVSON)).toBe(false);
    expect(setText).not.toHaveBeenCalled();
  });

  it('is last-writer-wins, so a rebuilt header supersedes its predecessor', () => {
    const first = vi.fn();
    const second = vi.fn();
    registerGridSearchControl({ input: fakeInput(), setText: first });
    registerGridSearchControl({ input: fakeInput(), setText: second });

    applyGridSearch('Tin Chen');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('Tin Chen');
  });
});
