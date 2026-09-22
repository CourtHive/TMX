import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The tournament-INFORMATION publish (factory 7.0.0, punch list P23).
 *
 * It is the only publish that makes a tournament public with no draw — the registration phase — so the
 * panel reads its state from `publishState.tournament.info`, and the scope it sends decides which events
 * the public information page lists.
 */

let publishState: any = {};

vi.mock('tods-competition-factory', () => ({
  tournamentEngine: {
    getCompetitionDateRange: () => ({ startDate: '2025-01-01', endDate: '2025-01-07' }),
    // the data module reads through the engine's `q` query namespace, not the bare methods
    q: {
      publishState: () => publishState?.tournament && { tournament: publishState.tournament },
      tournament: () => ({}),
      events: () => [],
    },
    getPublishState: () => ({ publishState }),
    getTournamentInfo: () => ({ tournamentInfo: {} }),
    getTournament: () => ({ tournamentRecord: {} }),
    getEvents: () => ({ events: [] }),
  },
  competitionEngine: {},
  publishingGovernor: { getPublishState: () => ({ publishState: {} }), isEmbargoed: () => false },
  tools: { generateDateRange: (s: string, e: string) => [s, e] },
}));
vi.mock('i18n', () => ({ t: (k: string) => k }));

import { getTournamentPublishData, infoScopeParams } from './publishingData';

beforeEach(() => {
  publishState = {};
});

describe('getTournamentPublishData — information', () => {
  it('reports an unpublished tournament, and carries no scope', () => {
    publishState = { tournament: {} };
    const data = getTournamentPublishData();
    expect(data.infoPublished).toBe(false);
    expect(data.infoEventIds).toBeUndefined();
  });

  it('reports the information publish, which no other flag reflects', () => {
    publishState = { tournament: { info: { published: true } } };
    const data = getTournamentPublishData();
    expect(data.infoPublished).toBe(true);
    // control: the registration-phase case — nothing else is published
    expect(data.oopPublished).toBe(false);
    expect(data.participantsPublished).toBe(false);
  });

  it('carries the scoped eventIds through to the panel', () => {
    publishState = { tournament: { info: { published: true, eventIds: ['e1'] } } };
    expect(getTournamentPublishData().infoEventIds).toEqual(['e1']);
  });
});

describe('infoScopeParams', () => {
  it('sends NO eventIds when every event is selected, so events added later are still listed', () => {
    expect(infoScopeParams(['e1', 'e2'], ['e1', 'e2'])).toEqual({});
  });

  it('sends the selection when it is a subset', () => {
    expect(infoScopeParams(['e1'], ['e1', 'e2'])).toEqual({ eventIds: ['e1'] });
  });

  it('sends no scope when nothing is selected, rather than listing nothing', () => {
    expect(infoScopeParams([], ['e1', 'e2'])).toEqual({});
  });

  it('sends no scope for a tournament with no events at all', () => {
    expect(infoScopeParams([], [])).toEqual({});
  });
});
