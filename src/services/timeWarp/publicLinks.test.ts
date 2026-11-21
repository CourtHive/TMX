import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPublicTournamentUrl, getPublicEventUrl, getPublicDrawUrl } from 'services/publishing/publicUrl';
import { setWarpSession } from './warpState';

vi.mock('settings/env', () => ({ env: { PUBLIC_URL: 'https://viewer.example.test' } }));
vi.mock('services/factory/engine', () => ({
  tournamentEngine: { getPublishState: () => ({ publishState: { status: { published: true } } }) },
}));

const SANDBOX_ID = 'time-warp-copy';

afterEach(() => setWarpSession());

describe('public viewer isolation', () => {
  it('keeps production links outside Warp, but never generates server links to a sandbox', () => {
    expect(getPublicTournamentUrl('production')).toContain('/tournament/production');
    expect(getPublicEventUrl({ tournamentId: 'production', eventId: 'event' })).toContain('/event/event');
    setWarpSession({ tournamentId: SANDBOX_ID } as any);
    expect(getPublicTournamentUrl('production')).toBe('');
    expect(getPublicDrawUrl({ tournamentId: SANDBOX_ID, eventId: 'event', drawId: 'draw' })).toBeUndefined();
    setWarpSession();
    expect(getPublicTournamentUrl(SANDBOX_ID)).toBe('');
    expect(getPublicEventUrl({ tournamentId: SANDBOX_ID, eventId: 'event' })).toBeUndefined();
  });
});
