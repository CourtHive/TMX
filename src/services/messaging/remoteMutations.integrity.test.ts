import { clearSyncIndicator, isSyncStale, markStaleNeedsRefresh, initRemoteMutationHandler } from './remoteMutations';
import { notifyAuthoritativeRefreshRequired } from 'services/mutation/mutationObservers';
const request = vi.hoisted(() => vi.fn());
const recovery = vi.hoisted(() => ({ listener: undefined as undefined | ((ids: string[]) => void) }));
vi.mock('services/apis/servicesApi', () => ({ requestTournament: request }));
vi.mock('services/messaging/socketIo', () => ({
  onTournamentMutation: vi.fn(),
  joinTournamentRoom: vi.fn(),
  onDurableRecovery: (listener: (ids: string[]) => void) => {
    recovery.listener = listener;
    return () => {};
  },
}));
vi.mock('services/storage/saveTournamentRecord', () => ({ saveTournamentRecord: vi.fn() }));
vi.mock('components/tables/common/navigateToEvent', () => ({ navigateToEvent: vi.fn() }));
vi.mock('components/notices/inlineNotice', () => ({ buildInlineNotice: vi.fn() }));
vi.mock('services/transitions/activeScoringGuard', () => ({ notifyRemoteScoringCollision: vi.fn() }));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: vi.fn() }));
vi.mock('services/context', () => ({ context: {} }));
vi.mock('config/debugConfig', () => ({ debugConfig: { get: () => ({}) } }));
vi.mock('i18n', () => ({ t: (key: string) => key }));
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tournamentEngine } from 'services/factory/engine';

const OWNER = 'refresh-owner';
const OTHER_OWNER = 'other-owner';

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
    tournamentEngine.setState({ tournamentId: OTHER_OWNER, tournamentName: 'Other' });
    answer({ data: { tournamentRecords: { [OWNER]: { tournamentId: OWNER, tournamentName: 'Old response' } } } });
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(tournamentEngine.getTournament().tournamentRecord?.tournamentId).toBe(OTHER_OWNER);
  });
  it('does not block another tournament or refresh the old one when the stale icon is clicked', () => {
    markStaleNeedsRefresh(OWNER);
    tournamentEngine.setState({ tournamentId: OTHER_OWNER, tournamentName: 'Other' });
    expect(isSyncStale()).toBe(false);
    click();
    expect(request).not.toHaveBeenCalled();
  });

  it('surfaces reconciliation only for the currently selected tournament', () => {
    initRemoteMutationHandler();
    notifyAuthoritativeRefreshRequired(['other']);
    expect(isSyncStale()).toBe(false);
    notifyAuthoritativeRefreshRequired([OWNER]);
    expect(isSyncStale()).toBe(true);
  });
  it('requires refresh after recovery only for the currently loaded tournament', () => {
    initRemoteMutationHandler();
    recovery.listener?.(['some-other-record']);
    expect(isSyncStale()).toBe(false);
    recovery.listener?.([OWNER]);
    expect(isSyncStale()).toBe(true);
  });
});
