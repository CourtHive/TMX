import { beforeEach, describe, expect, it, vi } from 'vitest';
const post = vi.hoisted(() => vi.fn());
vi.mock('services/apis/baseApi', () => ({ baseApi: { post } }));
import { loadCallerGrants } from './loadCallerGrants';
import { getCallerGrants } from './scopeState';

describe('grant request ownership', () => {
  beforeEach(() => post.mockReset());
  it('does not let an older response replace the newer tournament grants', async () => {
    let answer: any;
    post.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    const old = loadCallerGrants('old');
    const grants = [{ capability: 'canEnterScores', scope: { courtIds: ['new-court'] } }];
    post.mockResolvedValueOnce({ data: { grants } });
    await loadCallerGrants('new');
    answer({ data: { grants: [{ capability: 'canEnterScores', scope: { courtIds: ['old-court'] } }] } });
    await old;
    expect(getCallerGrants()).toEqual(grants);
  });
});
