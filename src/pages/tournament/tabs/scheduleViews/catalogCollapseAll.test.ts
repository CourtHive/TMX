import { everyGroupCollapsed, toggledCollapsedGroups } from './catalogCollapseAll';
import { describe, expect, it, vi } from 'vitest';

vi.mock('i18n', () => ({ t: (key: string) => key }));

const MENS = 'Men’s Singles';
const VISIBLE = [MENS, 'Women’s Singles'];

describe('collapse all', () => {
  it('collapses every visible group when any is expanded', () => {
    expect(toggledCollapsedGroups(VISIBLE, new Set())).toEqual(VISIBLE);
    expect(toggledCollapsedGroups(VISIBLE, new Set([VISIBLE[0]]))).toEqual(VISIBLE);
  });

  it('expands them all when every visible group is collapsed', () => {
    expect(everyGroupCollapsed(VISIBLE, new Set(VISIBLE))).toBe(true);
    expect(toggledCollapsedGroups(VISIBLE, new Set(VISIBLE))).toEqual([]);
  });

  it('judges only the groups on screen, and drops keys of groups a filter hides', () => {
    // A collapsed group hidden by a search must not keep the visible ones from reading as all collapsed.
    const collapsed = new Set([...VISIBLE, 'Hidden By Search']);
    expect(everyGroupCollapsed(VISIBLE, collapsed)).toBe(true);
    expect(toggledCollapsedGroups([MENS], new Set())).toEqual([MENS]);
  });

  it('is never "all collapsed" with nothing on screen', () => {
    expect(everyGroupCollapsed([], new Set(['x']))).toBe(false);
  });
});
