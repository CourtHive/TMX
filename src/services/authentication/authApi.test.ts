import { beforeEach, describe, expect, it, vi } from 'vitest';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('services/apis/baseApi', () => ({ baseApi: { post } }));

import { requestMagicLink, consumeMagicLink } from './authApi';

beforeEach(() => {
  post.mockReset();
});

describe('authApi magic-link', () => {
  it('requestMagicLink posts the email to /auth/magic/request', async () => {
    post.mockResolvedValue({ status: 200, data: { ok: true } });
    await requestMagicLink('a@test.com');
    expect(post).toHaveBeenCalledWith('/auth/magic/request', { email: 'a@test.com' });
  });

  it('consumeMagicLink posts the code to /auth/magic/consume with errors silenced', async () => {
    post.mockResolvedValue({ status: 200, data: { token: 't', refreshToken: 'r' } });
    await consumeMagicLink('mlk_abc');
    expect(post).toHaveBeenCalledWith('/auth/magic/consume', { code: 'mlk_abc' }, { silenceErrors: true });
  });
});
