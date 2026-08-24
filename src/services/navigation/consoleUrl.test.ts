import { describe, expect, it } from 'vitest';

import { consoleGrantsRoute, consoleUrl } from './consoleUrl';

describe('consoleUrl', () => {
  it('returns the console root when no route is given', () => {
    expect(consoleUrl('https://courthive.net')).toBe('https://courthive.net/console/');
  });

  // The console routes with Navigo in hash mode, so the route has to land after
  // the '#' or it resolves against the server instead.
  it('places a route in the hash, after the trailing slash', () => {
    expect(consoleUrl('https://courthive.net', '/grants/t1')).toBe('https://courthive.net/console/#/grants/t1');
  });

  it('works against a dev origin with a port', () => {
    expect(consoleUrl('http://localhost:8080', '/grants/t1')).toBe('http://localhost:8080/console/#/grants/t1');
  });
});

describe('consoleGrantsRoute', () => {
  it('builds the tournament-scoped grants route', () => {
    expect(consoleGrantsRoute('3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe(
      '/grants/3f2504e0-4f89-11d3-9a0c-0305e82c3301',
    );
  });

  it('encodes an id that would otherwise break the route', () => {
    expect(consoleGrantsRoute('a/b?c#d')).toBe('/grants/a%2Fb%3Fc%23d');
  });
});
