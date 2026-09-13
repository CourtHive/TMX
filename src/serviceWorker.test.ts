import { serviceWorkerEnabled, serviceWorkerUrl } from './serviceWorker';
import { describe, expect, it } from 'vitest';

describe('serviceWorkerEnabled — off unless somebody said otherwise', () => {
  it('is false for an unset flag, which is what an unconfigured build carries', () => {
    // The whole safety argument rests on this: a service worker outlives the
    // deployment that installed it, so the default has to be "do not install".
    expect(serviceWorkerEnabled(undefined)).toBe(false);
    expect(serviceWorkerEnabled('')).toBe(false);
  });

  it('is true only for an explicit opt-in value', () => {
    expect(serviceWorkerEnabled('true')).toBe(true);
    expect(serviceWorkerEnabled('1')).toBe(true);
  });

  it('is false for anything that merely looks affirmative', () => {
    // Matched by value rather than truthiness: under truthiness, 'false' and
    // 'no' both turn it ON, which is the wrong direction to be wrong in.
    for (const flag of ['false', '0', 'no', 'off', 'yes', 'TRUE', 'undefined']) {
      expect(serviceWorkerEnabled(flag)).toBe(false);
    }
  });
});

describe('serviceWorkerUrl — the app own base, not PUBLIC_URL', () => {
  it('resolves against a sub-path deployment', () => {
    // TMX is served from /tmx/ in production; the worker has to be fetched from
    // there, which is also what scopes it to this app rather than its
    // neighbours on the same host.
    expect(serviceWorkerUrl('/tmx/')).toBe('/tmx/sw.js');
  });

  it('resolves against the root', () => {
    expect(serviceWorkerUrl('/')).toBe('/sw.js');
  });

  it('keeps a relative base relative — the vite default when `base` is empty', () => {
    expect(serviceWorkerUrl('./')).toBe('./sw.js');
  });

  it('adds the separator when the base lacks one', () => {
    expect(serviceWorkerUrl('/tmx')).toBe('/tmx/sw.js');
  });
});
