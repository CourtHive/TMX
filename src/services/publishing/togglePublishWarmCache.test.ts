import { describe, expect, it, vi, beforeEach } from 'vitest';

const mutationRequest = vi.fn();
vi.mock('services/mutation/mutationRequest', () => ({ mutationRequest: (args: any) => mutationRequest(args) }));
vi.mock('functions/logMutationError', () => ({ logMutationError: vi.fn() }));
vi.mock('services/factory/engine', () => ({
  tournamentEngine: { q: { publishState: () => ({ status: { published: true } }) } },
}));
vi.mock('constants/mutationConstants', () => ({
  PUBLISH_EVENT: 'publishEvent',
  UNPUBLISH_EVENT: 'unPublishEvent',
}));

import { toggleEventPublishState } from './toggleEventPublishState';
import { toggleDrawPublishState } from './toggleDrawPublishState';

/**
 * `warmCache` asks the server to rebuild the event payload so the first public reader after a draw
 * release does not pay a cache miss. It is opt-in precisely because that rebuild is expensive
 * (~92ms for a Grand-Slam-shaped tournament's five events), so it must be sent ONLY when a reader is
 * actually imminent — publishing. Sending it on unpublish would pay the cost for nobody.
 */
describe('publish toggles set warmCache only when releasing', () => {
  const cellFor = (rowData: any) => ({
    getRow: () => ({ getData: () => rowData, update: vi.fn() }),
  });

  beforeEach(() => mutationRequest.mockClear());

  describe('toggleEventPublishState', () => {
    const nestedTables = new Map([['e1', { getRows: () => [] }]]);

    it('warms when publishing an unpublished event', () => {
      toggleEventPublishState(nestedTables)(null, cellFor({ eventId: 'e1', published: false }));

      const args = mutationRequest.mock.calls[0][0];
      expect(args.methods[0].method).toBe('publishEvent');
      expect(args.warmCache).toBe(true);
    });

    it('does NOT warm when unpublishing', () => {
      toggleEventPublishState(nestedTables)(null, cellFor({ eventId: 'e1', published: true }));

      const args = mutationRequest.mock.calls[0][0];
      expect(args.methods[0].method).toBe('unPublishEvent');
      expect(args.warmCache).toBe(false);
    });
  });

  describe('toggleDrawPublishState', () => {
    // Both directions use PUBLISH_EVENT here, so the signal is drawIdsToAdd vs drawIdsToRemove —
    // the method name alone cannot distinguish them.
    const eventRow = { getData: () => ({ eventId: 'e1' }), update: vi.fn() };

    it('warms when adding a draw to the published set', () => {
      toggleDrawPublishState(eventRow)(null, cellFor({ eventId: 'e1', drawId: 'd1', published: false }));

      const args = mutationRequest.mock.calls[0][0];
      expect(args.methods[0].params.drawIdsToAdd).toEqual(['d1']);
      expect(args.warmCache).toBe(true);
    });

    it('does NOT warm when removing a draw', () => {
      toggleDrawPublishState(eventRow)(null, cellFor({ eventId: 'e1', drawId: 'd1', published: true }));

      const args = mutationRequest.mock.calls[0][0];
      expect(args.methods[0].params.drawIdsToRemove).toEqual(['d1']);
      expect(args.warmCache).toBe(false);
    });
  });
});
