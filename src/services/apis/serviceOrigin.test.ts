import { afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ desktop: false, socketPath: '', defaultServer: 'http://localhost:8383' }));

vi.mock('platform', () => ({
  platform: { isDesktop: () => h.desktop, getDefaultServerUrl: () => h.defaultServer },
}));
vi.mock('config/serverConfig', () => ({ serverConfig: { get: () => ({ socketPath: h.socketPath }) } }));

import { serviceOrigin, siblingServiceBaseUrl } from './serviceOrigin';

const PROD = 'https://courthive.net';

describe('serviceOrigin', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.assign(h, { desktop: false, socketPath: '', defaultServer: 'http://localhost:8383' });
  });

  it('is the page origin on the web', () => {
    vi.stubGlobal('location', { origin: PROD });
    expect(serviceOrigin()).toBe(PROD);
    expect(siblingServiceBaseUrl(3130, '/ams')).toBe(`${PROD}/ams`);
  });

  it('is the configured server on desktop, where the page origin is app://tmx', () => {
    // The defect: `${location.origin}/ams` was `app://tmx/ams`, which no request can reach.
    vi.stubGlobal('location', { origin: 'app://tmx' });
    h.desktop = true;
    h.socketPath = `${PROD}/`;
    expect(serviceOrigin()).toBe(PROD);
    expect(siblingServiceBaseUrl(3120, '/declarations')).toBe(`${PROD}/declarations`);
  });

  it('falls back to the desktop default server, and uses dev ports when it is local', () => {
    vi.stubGlobal('location', { origin: 'app://tmx' });
    h.desktop = true;
    expect(siblingServiceBaseUrl(3130, '/ams')).toBe('http://localhost:3130');
  });

  it('keeps dev ports for a local web dev server', () => {
    vi.stubGlobal('location', { origin: 'http://127.0.0.1:5173' });
    expect(siblingServiceBaseUrl(3120, '/declarations')).toBe('http://localhost:3120');
  });
});
