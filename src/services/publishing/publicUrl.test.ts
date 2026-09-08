import { describe, expect, it } from 'vitest';

import { resolvePublicBaseUrl } from './publicUrl';

describe('resolvePublicBaseUrl', () => {
  it('maps the TMX mount to the public viewer', () => {
    expect(
      resolvePublicBaseUrl({
        currentHref: 'https://tmx.example/tmx/#/tournament/t1/publishing',
      }),
    ).toBe('https://tmx.example/pub');
  });

  it('discards an accidental path suffix after the TMX mount', () => {
    expect(
      resolvePublicBaseUrl({
        currentHref: 'https://tmx.example/tmx/pub/#/tournament/t1/publishing',
      }),
    ).toBe('https://tmx.example/pub');
  });

  it('preserves a deployment prefix before the TMX mount', () => {
    expect(
      resolvePublicBaseUrl({
        currentHref: 'https://example.test/tennis/tmx/pub/',
      }),
    ).toBe('https://example.test/tennis/pub');
  });

  it('resolves path-only configuration from the origin root', () => {
    expect(
      resolvePublicBaseUrl({
        configuredUrl: 'pub',
        currentHref: 'https://tmx.example/tmx/pub/',
      }),
    ).toBe('https://tmx.example/pub');
  });
});
