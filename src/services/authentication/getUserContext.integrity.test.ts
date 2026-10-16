import { expect, it, vi } from 'vitest';
const get = vi.hoisted(() => vi.fn());
vi.mock('services/apis/baseApi', () => ({ baseApi: { get } }));
import { clearUserContext, fetchUserContext, getUserContext } from './getUserContext';
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
