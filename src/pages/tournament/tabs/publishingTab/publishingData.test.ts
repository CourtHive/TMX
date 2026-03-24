import { describe, expect, it, vi } from 'vitest';

vi.mock('tods-competition-factory', () => ({
  tournamentEngine: {
    getEvents: () => ({ events: [] }),
    getCompetitionDateRange: () => ({ startDate: '2025-01-01', endDate: '2025-01-07' }),
    getTournamentInfo: () => ({ tournamentInfo: {} }),
    getPublishState: () => ({ publishState: {} }),
    getTournament: () => ({ tournamentRecord: {} }),
  },
  publishingGovernor: {
    getPublishState: () => ({ publishState: {} }),
  },
  tools: {
    generateDateRange: (s: string, e: string) => [s, e],
  },
}));
vi.mock('i18n', () => ({ t: (k: string) => k }));

import { resolvePublishState } from './publishingData';

const futureDate = new Date(Date.now() + 60_000).toISOString();
const pastDate = new Date(Date.now() - 60_000).toISOString();

describe('resolvePublishState', () => {
  it('returns off when not published', () => {
    expect(resolvePublishState(false)).toBe('off');
  });

  it('returns off when not published even with embargo', () => {
    expect(resolvePublishState(false, futureDate)).toBe('off');
  });

  it('returns live when published with no embargo', () => {
    expect(resolvePublishState(true)).toBe('live');
  });

  it('returns live when published with expired embargo', () => {
    expect(resolvePublishState(true, pastDate)).toBe('live');
  });

  it('returns embargoed when published with active embargo', () => {
    expect(resolvePublishState(true, futureDate)).toBe('embargoed');
  });
});
