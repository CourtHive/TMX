import { describe, expect, it } from 'vitest';
import {
  normalizeServerUrl,
  SAVE_EXTENSIONS,
  safeDefaultName,
  allowedFilters,
  isAppBlobUrl,
  externalUrl,
  isAppUrl,
} from './policy';

const APP = 'file:///Applications/TMX.app/Contents/Resources/app.asar/dist/index.html';
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
    expect(normalizeServerUrl('https://courthive.net/')).toBe('https://courthive.net');
    expect(normalizeServerUrl(' https://courthive.net/api/ ')).toBe('https://courthive.net/api');
    expect(normalizeServerUrl('http://localhost:8383')).toBe('http://localhost:8383');
    expect(normalizeServerUrl('http://127.0.0.1:8383')).toBe('http://127.0.0.1:8383');
  });
  it('refuses other schemes, remote http, credentials and garbage', () => {
    for (const value of [
      'javascript:alert(1)',
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
    expect(normalizeServerUrl('https://courthive.net/?x=1#y')).toBe('https://courthive.net');
  });
});

describe('isAppUrl', () => {
  it('matches the packaged index.html whatever its hash or query', () => {
    expect(isAppUrl(`${APP}#/tournament/t1`, APP)).toBe(true);
    expect(isAppUrl(`${APP}?x=1`, APP)).toBe(true);
  });
  it('refuses any other file, and any other origin', () => {
    expect(isAppUrl('file:///etc/hosts', APP)).toBe(false);
    expect(isAppUrl('https://example.com/', APP)).toBe(false);
    expect(isAppUrl('blob:file:///abc', APP)).toBe(false);
  });
  it('matches by origin for the development server', () => {
    expect(isAppUrl('http://localhost:5173/#/x', DEV)).toBe(true);
    expect(isAppUrl('http://localhost:5174/', DEV)).toBe(false);
  });
});

describe('isAppBlobUrl', () => {
  it('matches blob: URLs minted by the app origin only', () => {
    expect(isAppBlobUrl('blob:file:///0b1c', APP)).toBe(true);
    expect(isAppBlobUrl('blob:http://localhost:5173/0b1c', DEV)).toBe(true);
    expect(isAppBlobUrl('blob:https://example.com/0b1c', APP)).toBe(false);
    expect(isAppBlobUrl('blob:https://example.com/0b1c', DEV)).toBe(false);
    expect(isAppBlobUrl('https://example.com/', APP)).toBe(false);
  });
});

describe('externalUrl', () => {
  it('passes https only', () => {
    expect(externalUrl('https://example.com/a')).toBe('https://example.com/a');
    for (const url of ['http://example.com', 'file:///etc/hosts', 'smb://share/x', 'javascript:alert(1)', 'x']) {
      expect(externalUrl(url), url).toBeUndefined();
    }
  });
});
