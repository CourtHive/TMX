/**
 * Unit tests for the crowd-relay REST client config surface.
 *
 * Focus: the crowd poll/promote surface is ON by default (a relay base URL is
 * always derived from the factory server URL), and a provider turns it off via
 * `settings.crowdScoring.enabled = false` (gated by `isCrowdScoringEnabled`,
 * evaluated per call so it reflects provider config loaded after boot).
 *
 * `@courthive/provider-config`'s `resolveCrowdScoringEnabled` is the real pure
 * function — only the TMX config singletons + axios are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub localStorage so config/localStorage.getJwtTokenStorageKey works at load.
const memStore: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memStore[k] ?? null,
  setItem: (k: string, v: string) => {
    memStore[k] = v;
  },
  removeItem: (k: string) => {
    delete memStore[k];
  },
  clear: () => {
    for (const k of Object.keys(memStore)) delete memStore[k];
  },
});

vi.mock('services/notifications/tmxToast', () => ({ tmxToast: vi.fn() }));

// Fake axios instance — capture the baseURL passed to create() so the derived
// default is observable via getScoreRelayURL().
const { fakeInstance } = vi.hoisted(() => ({
  fakeInstance: {
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    defaults: { headers: { common: {} }, baseURL: '' },
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  } as any,
}));
vi.mock('axios', () => ({
  default: {
    create: (opts: any) => {
      fakeInstance.defaults.baseURL = opts?.baseURL ?? '';
      return fakeInstance;
    },
  },
}));

// Dev host by default so the derived base is the standalone relay on :8384.
vi.mock('config/serverConfig', () => ({
  serverConfig: { get: () => ({ socketPath: 'http://localhost:8383' }) },
}));

// Mutable provider config so tests flip crowdScoring.enabled.
const { mockProviderConfig } = vi.hoisted(() => ({
  mockProviderConfig: { current: {} as any },
}));
vi.mock('config/providerConfig', () => ({
  providerConfig: { get: () => mockProviderConfig.current },
}));

import { isScoreRelayConfigured, isCrowdScoringEnabled, getScoreRelayURL } from './scoreRelayApi';

describe('scoreRelayApi crowd surface', () => {
  beforeEach(() => {
    mockProviderConfig.current = {};
  });

  it('derives a relay base URL by default (ON — no VITE_SCORE_RELAY_URL needed)', () => {
    // localhost dev → standalone relay on :8384
    expect(getScoreRelayURL()).toBe('http://localhost:8384');
    expect(isScoreRelayConfigured()).toBe(true);
  });

  it('isCrowdScoringEnabled is true when the provider declares no crowdScoring (default ON)', () => {
    mockProviderConfig.current = {};
    expect(isCrowdScoringEnabled()).toBe(true);
  });

  it('isCrowdScoringEnabled is true when crowdScoring is present but enabled is unset', () => {
    mockProviderConfig.current = { crowdScoring: {} };
    expect(isCrowdScoringEnabled()).toBe(true);
  });

  it('isCrowdScoringEnabled is false only when the provider explicitly disables it', () => {
    mockProviderConfig.current = { crowdScoring: { enabled: false } };
    expect(isCrowdScoringEnabled()).toBe(false);
  });

  it('isCrowdScoringEnabled is true when the provider explicitly enables it', () => {
    mockProviderConfig.current = { crowdScoring: { enabled: true } };
    expect(isCrowdScoringEnabled()).toBe(true);
  });
});
