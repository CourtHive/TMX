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

import { getTournamentPublishData, infoScopeParams, resolvePublishState } from './publishingData';

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

describe('getTournamentPublishData — the information embargo (P23 D4b)', () => {
  const FUTURE = '2099-01-01T00:00:00Z';

  it('carries the embargo through to the panel', () => {
    publishState = { tournament: { info: { published: true, embargo: FUTURE } } };
    expect(getTournamentPublishData().infoEmbargo).toEqual(FUTURE);
  });

  it('is undefined when no embargo was set — the ordinary case', () => {
    publishState = { tournament: { info: { published: true } } };
    expect(getTournamentPublishData().infoEmbargo).toBeUndefined();
  });

  it('still reports the tournament as PUBLISHED while the embargo is pending', () => {
    // Intent and visibility differ, and the toggle reflects intent. A panel that showed this as
    // unpublished would invite the director to publish something already published.
    publishState = { tournament: { info: { published: true, embargo: FUTURE } } };
    expect(getTournamentPublishData().infoPublished).toBe(true);
  });
});

describe('resolvePublishState — the badge the information panel renders', () => {
  const FUTURE = '2099-01-01T00:00:00Z';
  const PAST = '2020-01-01T00:00:00Z';

  it('distinguishes withheld from live, which is the whole point of the embargo', () => {
    expect(resolvePublishState(true, FUTURE)).toBe('embargoed');
    expect(resolvePublishState(true, undefined)).toBe('live');
  });

  it('treats a past embargo as live, matching what the factory and the read model do', () => {
    expect(resolvePublishState(true, PAST)).toBe('live');
  });

  it('never reports an embargo on something unpublished', () => {
    // The factory cannot produce that state; rendering it would invent a status.
    expect(resolvePublishState(false, FUTURE)).toBe('off');
  });
});
