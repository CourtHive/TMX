import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  participants: vi.fn(),
  events: vi.fn(),
  fingerprint: vi.fn(),
  open: vi.fn(),
}));

vi.mock('services/factory/engine', () => ({
  tournamentEngine: { getParticipants: mocks.participants, q: { events: mocks.events } },
}));
vi.mock('./participantFingerprint', () => ({ buildParticipantFingerprint: mocks.fingerprint }));
vi.mock('components/tables/pointsTable/policyUtils', () => ({ getAvailablePolicies: () => [] }));
vi.mock('components/tables/common/navigateToEvent', () => ({ navigateToEvent: vi.fn() }));
vi.mock('courthive-components', () => ({ cModal: { open: mocks.open }, controlBar: vi.fn() }));
vi.mock('tabulator-tables', () => ({ TabulatorFull: vi.fn() }));
vi.mock('i18n', () => ({ t: (key: string) => key }));

import { participantProfileModal } from './participantProfileModal';

function element() {
  return { style: {}, appendChild: vi.fn(), textContent: '' };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('shares one participant query and one events query across the card sections', () => {
  const participant = { participantId: 'p1', participantName: 'Player', events: [{ eventId: 'e1' }] };
  const matchUps = [{ matchUpId: 'm1', sides: [{ participant: { ratings: { SINGLES: [] } } }] }];
  mocks.participants.mockReturnValue({ participants: [participant], matchUps });
  mocks.events.mockReturnValue([{ eventId: 'e1', eventName: 'Singles' }]);
  vi.stubGlobal('document', { createElement: element });

  participantProfileModal({ participantId: 'p1' });

  expect(mocks.participants).toHaveBeenCalledTimes(1);
  expect(mocks.participants).toHaveBeenCalledWith(
    expect.objectContaining({
      withRankingProfile: true,
      withMatchUps: true,
      withScaleValues: true,
    }),
  );
  expect(mocks.events).toHaveBeenCalledTimes(1);
  expect(mocks.fingerprint).toHaveBeenCalledWith({ participantId: 'p1', participant, matchUps });
  expect(mocks.open).toHaveBeenCalledTimes(1);
});
