import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mocksEngine, tournamentEngine } from 'tods-competition-factory';

/**
 * Check-in slice 3 (planning/TMX_CHECK_IN_INTENTS_AND_RECONNECT.md, "No-op propagation rule"). The server leaves a
 * presence intention it found already satisfied out of `appliedMethods`. This copy must apply exactly what the
 * server acknowledged — never its own directive — and, when the requested state then does not hold here, ask for
 * the authoritative record instead of fabricating the attestation another desk's write produced.
 */

const h = vi.hoisted(() => ({ emitTmx: vi.fn() }));

vi.mock('services/messaging/socketIo', () => ({ emitTmx: (...a: any[]) => h.emitTmx(...a) }));
vi.mock('services/session/sessionGuard', () => ({ isSessionValid: () => true, reportSessionLost: vi.fn() }));
vi.mock('services/staleness/stalenessGuard', () => ({ isStale: () => false, resetActivityTimer: vi.fn() }));
vi.mock('services/authentication/getUserContext', () => ({
  ensureUserContext: async () => ({ providerIds: ['prov-1'], isSuperAdmin: false }),
  getUserContext: () => undefined,
}));
vi.mock('services/authentication/loginState', () => ({
  getLoginState: () => ({ email: 'td@x.com' }),
  styleLogin: vi.fn(),
}));
vi.mock('services/storage/saveTournamentRecord', () => ({ saveTournamentRecord: vi.fn(async () => undefined) }));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: vi.fn() }));
vi.mock('config/serverConfig', () => ({ serverConfig: { get: () => ({ serverFirst: true, serverTimeout: 50 }) } }));
vi.mock('config/debugConfig', () => ({ debugConfig: { get: () => ({}) } }));
vi.mock('config/providerConfig', () => ({
  providerConfig: { get: () => ({ permissions: {} }), effectivePermissions: () => ({}) },
}));
vi.mock('@courthive/provider-config', () => ({ isMutationAllowed: () => true }));
vi.mock('services/context', () => ({ context: {} }));
vi.mock('i18n', () => ({ t: (key: string) => key }));

import { onAuthoritativeRefreshRequired } from 'services/mutation/mutationObservers';
import { mutationRequest, replayServerMutation } from './mutationRequest';

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

function seed() {
  const { tournamentRecord } = mocksEngine.generateTournamentRecord({
    tournamentAttributes: { tournamentId: 'tid-1', parentOrganisation: { organisationId: 'prov-1' } as any },
    startDate: '2026-01-01',
    endDate: '2099-12-31',
    drawProfiles: [{ drawSize: 4 }],
  });
  tournamentEngine.setState(tournamentRecord);
  const matchUp: any = tournamentEngine.allTournamentMatchUps({ matchUpFilters: { roundNumbers: [1] } }).matchUps?.[0];
  return { matchUpId: matchUp.matchUpId, drawId: matchUp.drawId, participantId: matchUp.sides[0].participantId };
}

const intention = (ids: Record<string, string>, attestationId?: string) => ({
  method: 'setParticipantCheckInState',
  params: { ...ids, checkedIn: true, ...(attestationId && { attestationId, occurredAt: '2026-11-12T22:00:00.000Z' }) },
});

const attestations = (ids: Record<string, string>) =>
  (tournamentEngine.getMatchUpCheckInHistory({ matchUpId: ids.matchUpId, drawId: ids.drawId }) as any).checkIns.map(
    (attestation: any) => attestation.attestationId,
  );

describe('mutationRequest — presence intentions the server found satisfied', () => {
  let refreshes: string[][];
  let stopObserving: () => void;

  beforeEach(() => {
    // makeMutation reads `window['dev']` for dev overrides; vitest here is the node environment.
    vi.stubGlobal('window', {});
    h.emitTmx.mockReset().mockReturnValue({ cancel: vi.fn() });
    refreshes = [];
    stopObserving = onAuthoritativeRefreshRequired((ids) => refreshes.push(ids));
  });

  afterEach(() => {
    stopObserving();
    vi.unstubAllGlobals();
  });

  const send = async (methods: any[], ack: any) => {
    const callback = vi.fn();
    await mutationRequest({ methods, callback });
    await settle();
    h.emitTmx.mock.calls[0][0].ackCallback(ack);
    await settle();
    return callback.mock.calls[0]?.[0];
  };

  it('applies the canonical transition the server acknowledged and needs no refresh', async () => {
    const ids = seed();
    const result = await send([intention(ids)], { success: true, appliedMethods: [intention(ids, 'server')] });

    expect(result.success).toBe(true);
    expect(result.refreshRequired).toBeUndefined();
    expect(attestations(ids)).toEqual(['server']);
    expect(refreshes).toEqual([]);
  });

  it('writes nothing and recovers when this copy missed the write that satisfied the intention', async () => {
    const ids = seed();
    const result = await send([intention(ids)], { success: true, appliedMethods: [] });

    expect(result).toMatchObject({ success: true, refreshRequired: true });
    expect(attestations(ids)).toEqual([]);
    expect(refreshes).toEqual([['tid-1']]);
    // recovery pulls the record; it never resubmits the operator's intention
    expect(h.emitTmx).toHaveBeenCalledTimes(1);
  });

  it('writes nothing and needs no refresh when this copy already held the state', async () => {
    const ids = seed();
    tournamentEngine.setParticipantCheckInState({ ...ids, checkedIn: true, attestationId: 'earlier' });
    const result = await send([intention(ids)], { success: true, appliedMethods: [] });

    expect(result.success).toBe(true);
    expect(result.refreshRequired).toBeUndefined();
    expect(attestations(ids)).toEqual(['earlier']);
    expect(refreshes).toEqual([]);
  });

  it('a session-restored replay recovers the same way', async () => {
    const ids = seed();
    replayServerMutation({ methods: [intention(ids)], factoryEngine: tournamentEngine, tournamentIds: ['tid-1'] });
    h.emitTmx.mock.calls[0][0].ackCallback({ success: true, appliedMethods: [] });
    await settle();

    expect(attestations(ids)).toEqual([]);
    expect(refreshes).toEqual([['tid-1']]);
  });
});
