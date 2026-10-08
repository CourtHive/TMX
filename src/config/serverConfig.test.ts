import { describe, expect, it, vi } from 'vitest';

vi.mock('platform', () => ({ platform: { getDefaultServerUrl: () => '' } }));

import { commandsOverHttpDefault, serverConfig } from './serverConfig';

// Realtime transport Phase 1, on by default since 2026-10-08 (CA). A build can still opt out.
describe('commandsOverHttp', () => {
  it('is on unless the build turns it off', () => {
    expect(commandsOverHttpDefault(undefined)).toBe(true);
    expect(commandsOverHttpDefault('')).toBe(true);
    expect(commandsOverHttpDefault('true')).toBe(true);
    expect(commandsOverHttpDefault('false')).toBe(false);
  });

  it('is on in the default config', () => {
    serverConfig.reset();
    expect(serverConfig.get().commandsOverHttp).toBe(true);
  });
});
