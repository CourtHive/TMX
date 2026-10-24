import { describe, expect, it } from 'vitest';
import {
  withAllowedExtension,
  hasAllowedExtension,
  normalizeServerUrl,
  isTrustedExternal,
  SAVE_EXTENSIONS,
  connectSources,
  resolveAppFile,
  safeDefaultName,
  allowedFilters,
  isAppBlobUrl,
  externalUrl,
  isAppUrl,
} from './policy';

const APP = 'app://tmx/index.html';
const DIST = '/Applications/TMX.app/Contents/Resources/app.asar/dist';
const JSON_FILTER = [{ name: 'JSON', extensions: ['json'] }];
const SERVER = 'https://courthive.net';
const SCRIPT_URL = 'javascript:alert(1)';
const LOCAL_SERVER = 'http://localhost:8383';
const ANY_LOCALHOST = 'http://localhost:*';
const REMOTE = 'https://example.com/';
const DEV = 'http://localhost:5173/';

describe('allowedFilters', () => {
  it('keeps filters whose every extension is allowed, lower-cased', () => {
    expect(allowedFilters([{ name: 'JSON', extensions: ['JSON'] }], SAVE_EXTENSIONS)).toEqual([
      { name: 'JSON', extensions: ['json'] },
    ]);
  });
  it('refuses a disallowed extension, an empty list, or a malformed request', () => {
    expect(allowedFilters([{ name: 'x', extensions: ['json', 'sh'] }], SAVE_EXTENSIONS)).toBeUndefined();
    expect(allowedFilters([{ name: 'x', extensions: ['*'] }], SAVE_EXTENSIONS)).toBeUndefined();
    expect(allowedFilters([], SAVE_EXTENSIONS)).toBeUndefined();
    expect(allowedFilters('json', SAVE_EXTENSIONS)).toBeUndefined();
    expect(allowedFilters([{ name: 'x' }], SAVE_EXTENSIONS)).toBeUndefined();
  });
});

describe('safeDefaultName', () => {
  it('drops every directory part, POSIX or Windows', () => {
    expect(safeDefaultName('../../Library/LaunchAgents/x.json')).toBe('x.json');
    expect(safeDefaultName('C:\\Users\\me\\Startup\\x.csv')).toBe('x.csv');
    expect(safeDefaultName('/etc/passwd')).toBe('passwd');
  });
  it('strips control characters and refuses names that are not files', () => {
    expect(safeDefaultName('a\u0000b\nc.json')).toBe('abc.json');
    expect(safeDefaultName('..')).toBeUndefined();
    expect(safeDefaultName('')).toBeUndefined();
    expect(safeDefaultName(42)).toBeUndefined();
  });
});

describe('normalizeServerUrl', () => {
  it('accepts https anywhere and http only on this machine', () => {
    expect(normalizeServerUrl('https://courthive.net/')).toBe(SERVER);
    expect(normalizeServerUrl(' https://courthive.net/api/ ')).toBe('https://courthive.net/api');
    expect(normalizeServerUrl(LOCAL_SERVER)).toBe(LOCAL_SERVER);
    expect(normalizeServerUrl('http://127.0.0.1:8383')).toBe('http://127.0.0.1:8383');
  });
  it('refuses other schemes, remote http, credentials and garbage', () => {
    for (const value of [
      SCRIPT_URL,
      'file:///etc/passwd',
      'http://evil.example',
      'http://localhost.evil.example',
      'https://user:pass@courthive.net',
      'ws://localhost:8383',
      'not a url',
      '',
      undefined,
    ]) {
      expect(normalizeServerUrl(value), String(value)).toBeUndefined();
    }
  });
  it('drops query and hash', () => {
    expect(normalizeServerUrl('https://courthive.net/?x=1#y')).toBe(SERVER);
  });
});

describe('isAppUrl', () => {
  it('matches the app origin whatever the path, hash or query', () => {
    expect(isAppUrl('app://tmx/index.html#/tournament/t1', APP)).toBe(true);
    expect(isAppUrl('app://tmx/assets/index.js?x=1', APP)).toBe(true);
    expect(isAppUrl('app://tmx', APP)).toBe(true);
  });
  it('refuses another host on the same scheme, file:, and any other origin', () => {
    expect(isAppUrl('app://evil/index.html', APP)).toBe(false);
    expect(isAppUrl('file:///Applications/TMX.app/Contents/Resources/app.asar/dist/index.html', APP)).toBe(false);
    expect(isAppUrl('file://evil-host/dist/index.html', APP)).toBe(false);
    expect(isAppUrl(REMOTE, APP)).toBe(false);
    expect(isAppUrl('blob:app://tmx/abc', APP)).toBe(false);
  });
  it('matches by origin for the development server', () => {
    expect(isAppUrl('http://localhost:5173/#/x', DEV)).toBe(true);
    expect(isAppUrl('http://localhost:5174/', DEV)).toBe(false);
  });
});

describe('isAppBlobUrl', () => {
  it('matches blob: URLs minted by the app origin only', () => {
    expect(isAppBlobUrl('blob:app://tmx/0b1c', APP)).toBe(true);
    expect(isAppBlobUrl('blob:http://localhost:5173/0b1c', DEV)).toBe(true);
    expect(isAppBlobUrl('blob:file:///0b1c', APP)).toBe(false);
    expect(isAppBlobUrl('blob:https://example.com/0b1c', APP)).toBe(false);
    expect(isAppBlobUrl(REMOTE, APP)).toBe(false);
  });
});

describe('resolveAppFile', () => {
  it('maps app://tmx paths into dist, with / as index.html', () => {
    expect(resolveAppFile('app://tmx/', DIST)).toBe(`${DIST}/index.html`);
    expect(resolveAppFile('app://tmx/assets/index-abc.js?v=1', DIST)).toBe(`${DIST}/assets/index-abc.js`);
  });
  it('refuses anything that escapes dist, another host or scheme', () => {
    // The URL parser collapses encoded dot segments itself, so this stays inside dist.
    expect(resolveAppFile('app://tmx/%2e%2e/%2e%2e/etc/passwd', DIST)).toBe(`${DIST}/etc/passwd`);
    expect(resolveAppFile('app://tmx/..%2f..%2fetc/passwd', DIST)).toBeUndefined();
    expect(resolveAppFile('app://tmx/assets/%00x.js', DIST)).toBeUndefined();
    expect(resolveAppFile('app://other/index.html', DIST)).toBeUndefined();
    expect(resolveAppFile('file:///etc/passwd', DIST)).toBeUndefined();
    expect(resolveAppFile('app://tmx/%E0%A4%A', DIST)).toBeUndefined();
  });
});

describe('extensions', () => {
  it('appends an allowed extension to any other name', () => {
    expect(withAllowedExtension('export.codes.json', JSON_FILTER)).toBe('export.codes.json');
    expect(withAllowedExtension('Update.bat', JSON_FILTER)).toBe('Update.bat.json');
    expect(withAllowedExtension('x.command', JSON_FILTER)).toBe('x.command.json');
    expect(withAllowedExtension('noext', JSON_FILTER)).toBe('noext.json');
  });
  it('checks the extension of the file name, not a directory', () => {
    expect(hasAllowedExtension('/Users/me/my.json/report', JSON_FILTER)).toBe(false);
    expect(hasAllowedExtension('C:/x/REPORT.JSON', JSON_FILTER)).toBe(true);
  });
});

describe('isTrustedExternal', () => {
  it('trusts CourtHive domains and the configured server host only', () => {
    expect(isTrustedExternal('https://courthive.com/docs')).toBe(true);
    expect(isTrustedExternal('https://pub.courthive.net/x')).toBe(true);
    expect(isTrustedExternal('https://courthive.com.evil.example/')).toBe(false);
    expect(isTrustedExternal('https://evilcourthive.com/')).toBe(false);
    expect(isTrustedExternal('https://tmx.example.org/a', 'https://tmx.example.org')).toBe(true);
    expect(isTrustedExternal(REMOTE)).toBe(false);
  });
});

describe('connectSources', () => {
  it('names the configured server for https and wss, and drops localhost when packaged', () => {
    expect(connectSources(SERVER, true)).toBe("connect-src 'self' https://courthive.net wss://courthive.net");
  });
  it('keeps local development hosts when unpackaged or when no server is set', () => {
    expect(connectSources(undefined, true)).toContain(ANY_LOCALHOST);
    expect(connectSources(SERVER, false)).toContain('ws://127.0.0.1:*');
    expect(connectSources(SCRIPT_URL, true)).toContain(ANY_LOCALHOST);
  });

  it('allows the other loopback ports when the configured server is local, but not for a remote one', () => {
    // A local CFS's relay (:8384), declarations (:3120) and AMS (:3130) sit beside it on loopback.
    const local = connectSources(LOCAL_SERVER, true);
    expect(local).toContain(ANY_LOCALHOST);
    expect(local).toContain('ws://127.0.0.1:*');
    expect(connectSources(SERVER, true)).not.toContain('localhost');
  });
});

describe('externalUrl', () => {
  it('passes https only', () => {
    expect(externalUrl('https://example.com/a')).toBe('https://example.com/a');
    for (const url of ['http://example.com', 'file:///etc/hosts', 'smb://share/x', SCRIPT_URL, 'x']) {
      expect(externalUrl(url), url).toBeUndefined();
    }
  });
});
