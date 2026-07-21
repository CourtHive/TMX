import { describe, it, expect, vi, beforeEach } from 'vitest';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
const { decideRegistration } = vi.hoisted(() => ({ decideRegistration: vi.fn() }));
vi.mock('./baseApi', () => ({ baseApi: { post } }));
vi.mock('./declarationsApi', () => ({ decideRegistration, fetchTournamentRegistrations: vi.fn() }));

import { bulkAcceptRegistrations, bulkRegistrationAction } from './registrationsApi';

beforeEach(() => {
  post.mockReset();
  decideRegistration.mockReset();
});

describe('bulkAcceptRegistrations', () => {
  it('posts all ids to accept-bulk in ONE call and maps reason→error', async () => {
    post.mockResolvedValue({
      data: {
        results: [
          { registrationId: 'r-1', ok: true, participantId: 'p-1' },
          { registrationId: 'r-2', ok: false, reason: 'no canonical name' },
        ],
      },
    });
    const { results } = await bulkAcceptRegistrations({ tournamentId: 't-1', registrationIds: ['r-1', 'r-2'] });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/admin/tournaments/t-1/registrations/accept-bulk', {
      registrationIds: ['r-1', 'r-2'],
      statusReason: undefined,
    });
    expect(results).toEqual([
      { registrationId: 'r-1', ok: true, participantId: 'p-1', error: undefined },
      { registrationId: 'r-2', ok: false, participantId: undefined, error: 'no canonical name' },
    ]);
  });
});

describe('bulkRegistrationAction', () => {
  it('accept → ONE bulk CFS call, not a per-id fan-out', async () => {
    post.mockResolvedValue({ data: { results: [{ registrationId: 'r-1', ok: true }, { registrationId: 'r-2', ok: true }] } });
    await bulkRegistrationAction({ tournamentId: 't-1', provider: 'PROV', action: 'accept', registrationIds: ['r-1', 'r-2'] });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toContain('/accept-bulk');
    expect(decideRegistration).not.toHaveBeenCalled();
  });

  it('waitlist → client fan-out to declarations (one call per id, no CFS)', async () => {
    decideRegistration.mockResolvedValue({});
    const { results } = await bulkRegistrationAction({
      tournamentId: 't-1',
      provider: 'PROV',
      action: 'waitlist',
      registrationIds: ['r-1', 'r-2'],
    });
    expect(post).not.toHaveBeenCalled();
    expect(decideRegistration).toHaveBeenCalledTimes(2);
    expect(decideRegistration).toHaveBeenCalledWith('PROV', 'r-1', 'WAITLISTED', undefined);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it('reject fan-out reports a per-id failure without aborting the rest', async () => {
    decideRegistration.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('boom'));
    const { results } = await bulkRegistrationAction({
      tournamentId: 't-1',
      provider: 'PROV',
      action: 'reject',
      registrationIds: ['r-1', 'r-2'],
    });
    expect(results.find((r) => r.registrationId === 'r-1')?.ok).toBe(true);
    expect(results.find((r) => r.registrationId === 'r-2')).toEqual({ registrationId: 'r-2', ok: false, error: 'boom' });
  });
});
