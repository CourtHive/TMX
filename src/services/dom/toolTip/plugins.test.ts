/**
 * Contract for the `dynContent` tippy plugin.
 *
 * Two invariants, both load-bearing:
 *   1. The top-level `name` equals the custom prop name (`dynContent`) — this is
 *      what makes tippy whitelist the prop (silences the dev-only "not a valid
 *      prop" warning) AND include it in getExtendedPassedProps.
 *   2. `onShow` pushes the result of `props.dynContent(reference)` into the
 *      tooltip via `setContent`, and no-ops when `dynContent` is absent — the
 *      lazy-content behavior the sidebar tooltips rely on.
 */
import { enhancedContentFunction } from './plugins';
import { describe, expect, it, vi } from 'vitest';

describe('enhancedContentFunction (dynContent plugin)', () => {
  it('exposes a top-level name matching the custom prop', () => {
    expect(enhancedContentFunction.name).toBe('dynContent');
  });

  it('onShow sets content from the dynContent function, passing the reference', () => {
    const reference = { id: 'ref' };
    const setContent = vi.fn();
    const dynContent = vi.fn(() => 'computed');
    const instance = { props: { dynContent }, reference, setContent };

    enhancedContentFunction.fn(instance).onShow();

    expect(dynContent).toHaveBeenCalledWith(reference);
    expect(setContent).toHaveBeenCalledWith('computed');
  });

  it('onShow is a no-op when dynContent is not a function', () => {
    const setContent = vi.fn();
    const instance = { props: {}, reference: {}, setContent };

    enhancedContentFunction.fn(instance).onShow();

    expect(setContent).not.toHaveBeenCalled();
  });
});
