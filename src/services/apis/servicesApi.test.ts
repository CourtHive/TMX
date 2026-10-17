import { serverSyncAt, setServerSync } from 'services/staleness/serverSync';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
vi.mock('./baseApi', () => ({ baseApi: { post: (...args: any[]) => post(...args) } }));

import { sendTournament } from './servicesApi';

// C3: sendTournament forwards the durable save fields and stamps the sync point only on success.
const TID = 'tournament-send';
const W1 = '2026-10-17T10:00:00.000Z';
const W2 = '2026-10-17T10:05:00.000Z';
const CMD = 'cmd-12345678';

describe('sendTournament', () => {
  beforeEach(() => {
    post.mockReset();
    setServerSync(TID, W1);
  });

  it('without a commandId: the plain body and baseApi defaults, as before', async () => {
    post.mockResolvedValue({ status: 200, data: { success: true, serverUpdatedAt: { [TID]: W2 } } });
    await sendTournament({ tournamentRecord: { tournamentId: TID } });
    expect(post).toHaveBeenCalledWith('/factory/save', { tournamentRecord: { tournamentId: TID } }, undefined);
    expect(serverSyncAt(TID)).toBe(Date.parse(W2));
  });

  it('with a commandId: forwards it and the precondition, and resolves every answer but a 401', async () => {
    post.mockResolvedValue({ status: 200, data: { success: true, serverUpdatedAt: { [TID]: W2 } } });
    const expectedServerUpdatedAt = { [TID]: W1 };
    await sendTournament({
      tournamentRecord: { tournamentId: TID },
      commandId: CMD,
      expectedServerUpdatedAt,
    });

    const [path, body, options] = post.mock.calls[0];
    expect(path).toBe('/factory/save');
    expect(body).toEqual({
      tournamentRecord: { tournamentId: TID },
      commandId: CMD,
      expectedServerUpdatedAt,
    });
    expect(options).toMatchObject({ silenceErrors: true, timeout: 20_000 });
    expect(options.validateStatus(409)).toBe(true);
    expect(options.validateStatus(503)).toBe(true);
    expect(options.validateStatus(401)).toBe(false);
  });

  it('a deduplicated answer stamps the write it reports, as the original answer would have', async () => {
    post.mockResolvedValue({
      status: 200,
      data: { success: true, deduplicated: true, serverUpdatedAt: { [TID]: W2 } },
    });
    await sendTournament({ tournamentRecord: { tournamentId: TID }, commandId: CMD });
    expect(serverSyncAt(TID)).toBe(Date.parse(W2));
  });

  it('a 409 leaves the sync point where it was: this copy is not at the server write it reports', async () => {
    post.mockResolvedValue({
      status: 409,
      data: { conflict: true, tournamentId: TID, expectedServerUpdatedAt: W1, serverUpdatedAt: W2 },
    });
    await sendTournament({ tournamentRecord: { tournamentId: TID }, commandId: CMD });
    expect(serverSyncAt(TID)).toBe(Date.parse(W1));
  });
});
