import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tournamentEngine } from 'services/factory/engine';
const request = vi.hoisted(() => vi.fn());
vi.mock('services/apis/servicesApi', () => ({ requestTournament: request }));
vi.mock('services/messaging/socketIo', () => ({ onTournamentMutation: vi.fn(), joinTournamentRoom: vi.fn() }));
vi.mock('services/storage/saveTournamentRecord', () => ({ saveTournamentRecord: vi.fn() }));
vi.mock('components/tables/common/navigateToEvent', () => ({ navigateToEvent: vi.fn() }));
vi.mock('components/notices/inlineNotice', () => ({ buildInlineNotice: vi.fn() }));
vi.mock('services/transitions/activeScoringGuard', () => ({ notifyRemoteScoringCollision: vi.fn() }));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: vi.fn() }));
vi.mock('services/context', () => ({ context: {} }));
vi.mock('config/debugConfig', () => ({ debugConfig: { get: () => ({}) } }));
vi.mock('i18n', () => ({ t: (key: string) => key }));
import { clearSyncIndicator, isSyncStale, markStaleNeedsRefresh } from './remoteMutations';

const OWNER = 'refresh-owner';

describe('explicit stale refresh ownership', () => {
  let click: () => void;
  beforeEach(() => {
    const indicator = {
      dataset: {},
      style: {},
      classList: { add() {}, remove() {} },
      addEventListener: (_: string, listener: () => void) => {
        click = listener;
      },
    };
    vi.stubGlobal('document', { getElementById: () => indicator });
    tournamentEngine.setState({ tournamentId: OWNER, tournamentName: 'Current' });
    clearSyncIndicator();
    request.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());
  it('keeps mutation blocking after a response with no record', async () => {
    request.mockResolvedValue({ data: {} });
    markStaleNeedsRefresh(OWNER);
    click();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(isSyncStale()).toBe(true);
  });
  it('does not install the refresh after another tournament becomes active', async () => {
    let answer: any;
    request.mockImplementation(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    markStaleNeedsRefresh(OWNER);
    click();
    tournamentEngine.setState({ tournamentId: 'other-owner', tournamentName: 'Other' });
    answer({ data: { tournamentRecords: { [OWNER]: { tournamentId: OWNER, tournamentName: 'Old response' } } } });
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(tournamentEngine.getTournament().tournamentRecord?.tournamentId).toBe('other-owner');
  });
});
