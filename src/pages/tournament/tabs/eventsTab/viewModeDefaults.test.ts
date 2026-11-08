import { readDrawsViewMode } from './renderDraws/drawsViewMode';
import { afterEach, describe, expect, it } from 'vitest';
import { readEventsViewMode } from './eventsViewMode';

/**
 * The events and draws views open on cards unless the user chose the table (CA 2026-11-08). A stored 'table' is a
 * choice and is kept; anything else, or storage that cannot be read, is cards.
 */
function storage(values: Record<string, string>) {
  (globalThis as any).localStorage = { getItem: (key: string) => values[key] ?? null, setItem: () => undefined };
}

const cases = [
  { read: readEventsViewMode, key: 'tmx_events_view_mode', name: 'events' },
  { read: readDrawsViewMode, key: 'tmx_draws_view_mode', name: 'draws' },
];

describe.each(cases)('$name view mode', ({ read, key }) => {
  afterEach(() => delete (globalThis as any).localStorage);

  it('no choice yet: cards', () => {
    storage({});
    expect(read()).toBe('grid');
  });

  it('a chosen table is kept, and so are chosen cards', () => {
    storage({ [key]: 'table' });
    expect(read()).toBe('table');
    storage({ [key]: 'grid' });
    expect(read()).toBe('grid');
  });

  it('an unknown value, or storage that throws: cards', () => {
    storage({ [key]: 'list' });
    expect(read()).toBe('grid');
    (globalThis as any).localStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(read()).toBe('grid');
  });
});
