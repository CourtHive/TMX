import { createServerSocket } from 'services/network/serverNetwork';
import { scoreRelayApi } from 'services/apis/scoreRelayApi';
import { describe, expect, it, vi } from 'vitest';
import { baseApi } from 'services/apis/baseApi';
import { devNetwork } from './devNetwork';

// scoreRelayApi resolves its base URL from window.location when the module loads, and vitest here is the node
// environment, so the stub must exist before the imports run (settingsStorage.test.ts stubs window the same way,
// later, because its module reads window lazily).
vi.hoisted(() => {
  vi.stubGlobal('window', { location: { origin: 'http://localhost', hostname: 'localhost', protocol: 'http:' } });
});

describe('devNetwork', () => {
  it('holds the very network clients the app uses, not copies', () => {
    expect(devNetwork.baseApi).toBe(baseApi);
    expect(devNetwork.scoreRelayApi).toBe(scoreRelayApi);
    expect(devNetwork.createServerSocket).toBe(createServerSocket);
  });
});
