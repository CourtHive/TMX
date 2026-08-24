import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCallerGrants, isScopeUnrestricted, setCallerGrants } from './scopeState';
import { loadCallerGrants } from './loadCallerGrants';

const post = vi.fn();
vi.mock('services/apis/baseApi', () => ({ baseApi: { post: (...args: any[]) => post(...args) } }));

const COURT_7 = { capability: 'canEnterScores', scope: { courtIds: ['court-7'] } };
const CENTRE = { capability: 'canEnterScores', scope: { courtIds: ['centre'] } };

beforeEach(() => {
  post.mockReset();
  setCallerGrants([]);
});

describe('loadCallerGrants', () => {
  it('populates the mask from the caller own grants', async () => {
    post.mockResolvedValue({ data: { grants: [COURT_7] } });
    await loadCallerGrants('t1');

    expect(post).toHaveBeenCalledWith('/factory/my-grants', { tournamentId: 't1' }, expect.anything());
    expect(getCallerGrants()).toEqual([COURT_7]);
    expect(isScopeUnrestricted()).toBe(false);
  });

  // The mask is a module singleton, so without clearing FIRST a failure would
  // leave the previous tournament's restriction applied to this one.
  it('clears the previous tournament grants before fetching', async () => {
    setCallerGrants([CENTRE]);
    post.mockRejectedValue(new Error('network'));

    await loadCallerGrants('t2');

    expect(getCallerGrants()).toEqual([]);
    expect(isScopeUnrestricted()).toBe(true);
  });

  it('replaces rather than merges when a new tournament has its own grants', async () => {
    setCallerGrants([CENTRE]);
    post.mockResolvedValue({ data: { grants: [COURT_7] } });

    await loadCallerGrants('t2');

    expect(getCallerGrants()).toEqual([COURT_7]);
  });

  // Unreachable server, a deployment predating the endpoint, an unmigrated
  // table — all mean "no scoped restriction", which is what the gate concludes.
  it('resolves to unrestricted when the request fails, without throwing', async () => {
    post.mockRejectedValue(new Error('404'));
    await expect(loadCallerGrants('t1')).resolves.toBeUndefined();
    expect(isScopeUnrestricted()).toBe(true);
  });

  it('treats an empty grant list as unrestricted rather than as locked down', async () => {
    post.mockResolvedValue({ data: { grants: [] } });
    await loadCallerGrants('t1');
    expect(isScopeUnrestricted()).toBe(true);
  });

  it('tolerates a payload without a grants array', async () => {
    post.mockResolvedValue({ data: {} });
    await loadCallerGrants('t1');
    expect(isScopeUnrestricted()).toBe(true);
  });

  it('does not call the server without a tournament, and still clears', async () => {
    setCallerGrants([CENTRE]);
    await loadCallerGrants(undefined);

    expect(post).not.toHaveBeenCalled();
    expect(isScopeUnrestricted()).toBe(true);
  });
});
