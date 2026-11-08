import { clearSyncIndicator, isSyncStale, markStaleNeedsRefresh, initRemoteMutationHandler } from './remoteMutations';
import { notifyAuthoritativeRefreshRequired } from 'services/mutation/mutationObservers';
const request = vi.hoisted(() => vi.fn());
const recovery = vi.hoisted(() => ({ listener: undefined as undefined | ((ids: string[]) => void) }));
const replaced = vi.hoisted(() => ({ listener: undefined as undefined | ((data: any) => void) }));
vi.mock('services/apis/servicesApi', () => ({ requestTournament: request }));
vi.mock('services/messaging/socketIo', () => ({
  onTournamentMutation: vi.fn(),
  onTournamentReplaced: (listener: (data: any) => void) => {
    replaced.listener = listener;
  },
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

// D4 of the super-admin provider move (Mentat planning/SUPERADMIN_TOURNAMENT_PROVIDER_MOVE.md): the server replaced the
// record outside executionQueue, so there is nothing to replay — the open copy must stop accepting mutations and reload.
describe('tournamentReplaced', () => {
  const flush = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  beforeEach(() => {
    vi.stubGlobal('document', { getElementById: () => null });
    tournamentEngine.setState({
      tournamentId: OWNER,
      tournamentName: 'Current',
      parentOrganisation: { organisationId: 'p-from' },
    });
    clearSyncIndicator();
    request.mockReset();
    initRemoteMutationHandler();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('blocks mutations at once and installs the record the server now holds', async () => {
    let answer: any;
    request.mockImplementation(() => new Promise((resolve) => (answer = resolve)));

    replaced.listener?.({ tournamentId: OWNER, reason: 'providerMoved' });
    expect(isSyncStale()).toBe(true);
    expect(request).toHaveBeenCalledWith({ tournamentId: OWNER });

    const moved = { tournamentId: OWNER, tournamentName: 'Current', parentOrganisation: { organisationId: 'p-to' } };
    answer({ data: { tournamentRecords: { [OWNER]: moved } } });
    await flush();
    expect(tournamentEngine.getTournament().tournamentRecord?.parentOrganisation?.organisationId).toBe('p-to');
    expect(isSyncStale()).toBe(false);
  });

  it('stays blocked when the reload is refused, rather than keeping a forked copy writable', async () => {
    request.mockRejectedValue(new Error('403'));
    replaced.listener?.({ tournamentId: OWNER, reason: 'providerMoved' });
    await flush();
    expect(isSyncStale()).toBe(true);
    expect(tournamentEngine.getTournament().tournamentRecord?.parentOrganisation?.organisationId).toBe('p-from');
  });

  it('ignores a replacement of a tournament this tab is not holding', () => {
    replaced.listener?.({ tournamentId: 'someone-else', reason: 'providerMoved' });
    expect(isSyncStale()).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
});
