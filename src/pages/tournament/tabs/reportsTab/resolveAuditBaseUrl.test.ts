import { resolveAuditBaseUrl } from './resolveAuditBaseUrl';
import { describe, expect, it } from 'vitest';

describe('resolveAuditBaseUrl', () => {
  it('uses /audit same-origin path on prod (courthive.net)', () => {
    expect(resolveAuditBaseUrl('https://courthive.net')).toBe('https://courthive.net/audit');
  });

  it('uses /audit same-origin path on dev (dev.courthive.net)', () => {
    expect(resolveAuditBaseUrl('https://dev.courthive.net')).toBe('https://dev.courthive.net/audit');
  });

  it('falls back to direct :8385 port on localhost vite dev', () => {
    expect(resolveAuditBaseUrl('http://localhost:5173')).toBe('http://localhost:8385');
  });

  it('strips and replaces the port for 127.0.0.1', () => {
    expect(resolveAuditBaseUrl('http://127.0.0.1:5173')).toBe('http://127.0.0.1:8385');
  });

  it('handles localhost with no port', () => {
    expect(resolveAuditBaseUrl('http://localhost')).toBe('http://localhost:8385');
  });

  it('does NOT treat hostnames containing localhost as localhost', () => {
    // The regex anchors at scheme://, so notlocalhost.example doesn't match
    expect(resolveAuditBaseUrl('https://notlocalhost.example')).toBe('https://notlocalhost.example/audit');
  });

  it('honors override regardless of origin', () => {
    expect(resolveAuditBaseUrl('https://courthive.net', 'https://audit.example/v1')).toBe('https://audit.example/v1');
    expect(resolveAuditBaseUrl('http://localhost:5173', 'http://audit.local:9000')).toBe('http://audit.local:9000');
  });

  it('treats empty origin as not-localhost (falls through to /audit)', () => {
    // Defensive — globalThis.location?.origin can be empty in some test contexts.
    // We still produce a usable relative path rather than a malformed URL.
    expect(resolveAuditBaseUrl('')).toBe('/audit');
  });
});
