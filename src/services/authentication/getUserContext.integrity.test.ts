import { clearUserContext, fetchUserContext, getUserContext, ensureUserContext } from './getUserContext';
const get = vi.hoisted(() => vi.fn());
vi.mock('services/apis/baseApi', () => ({ baseApi: { get } }));
import { beforeEach, expect, it, vi } from 'vitest';
it('does not repopulate a user cache cleared during an earlier auth request', async () => {
  let answer: any;
  get.mockImplementation(
    () =>
      new Promise((resolve) => {
        answer = resolve;
      }),
  );
  const fetch = fetchUserContext();
  clearUserContext();
  answer({ data: { userId: 'old-user', providerIds: [] } });
  await fetch;
  expect(getUserContext()).toBeUndefined();
});

beforeEach(() => {
  clearUserContext();
  get.mockReset();
});
it('shares an auth fetch between boot and concurrent provider-only mutations', async () => {
  let answer: any;
  get.mockImplementation(
    () =>
      new Promise((resolve) => {
        answer = resolve;
      }),
  );
  const boot = fetchUserContext();
  const first = ensureUserContext();
  const second = ensureUserContext();
  const context = {
    userId: 'linked-user',
    providerIds: ['provider-only-link'],
    providerRoles: { 'provider-only-link': ['DIRECTOR'] },
  };
  answer({ data: context });
  expect(await Promise.all([boot, first, second])).toEqual([context, context, context]);
  expect(get).toHaveBeenCalledTimes(1);
});
