import { beforeEach, describe, expect, it, vi } from 'vitest';

const controlBar = vi.fn((_: any) => ({ elements: {} }));
vi.mock('courthive-components', () => ({ controlBar: (args: any) => controlBar(args) }));
vi.mock('services/mutation/mutationRequest', () => ({ mutationRequest: vi.fn() }));
vi.mock('config/providerConfig', () => ({ providerConfig: { isAllowed: () => true } }));
vi.mock('./addVenue', () => ({ addVenue: vi.fn() }));

import { venueControl } from './venueControl';

const anchor = {} as HTMLElement; // venueControl only checks that it has one; controlBar is mocked
const itemIds = () => controlBar.mock.calls.at(-1)?.[0].items.map((item: any) => item.id ?? item.label);
const item = (id: string) => controlBar.mock.calls.at(-1)?.[0].items.find((i: any) => i.id === id);

describe('venueControl — the Transit view’s way back sits where the way in was', () => {
  beforeEach(() => controlBar.mockClear());

  it('the list bar offers [Transit times]', () => {
    const onTransit = vi.fn();
    venueControl({ controlAnchor: anchor, updateVenueRow: vi.fn(), onTransit });
    expect(item('venueTransit')).toMatchObject({ hide: false });
    expect(item('venuesList')).toBeUndefined();
    item('venueTransit').onClick();
    expect(onTransit).toHaveBeenCalledOnce();
  });

  it('the Transit view’s bar puts [Venues] in the same slot, beside the same neighbours', () => {
    venueControl({ controlAnchor: anchor, updateVenueRow: vi.fn(), onTransit: vi.fn() });
    const listSlots = itemIds();

    const onVenues = vi.fn();
    venueControl({ controlAnchor: anchor, updateVenueRow: vi.fn(), onVenues });
    const transitSlots = itemIds();

    expect(transitSlots).toEqual(listSlots.map((id: string) => (id === 'venueTransit' ? 'venuesList' : id)));
    expect(item('venuesList')).toMatchObject({ location: 'right' });
    expect(item('venuesList').hide).toBeFalsy();
    item('venuesList').onClick();
    expect(onVenues).toHaveBeenCalledOnce();
  });
});
